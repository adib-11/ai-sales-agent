import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { generateSubdomain } from '@/lib/subdomain';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting: 5 requests per 15 minutes per IP
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(clientIp, {
      maxRequests: 5,
      windowMs: 15 * 60 * 1000, // 15 minutes
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many registration attempts. Please try again later.',
            details: {
              resetTime: new Date(rateLimit.resetTime).toISOString(),
            },
          },
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': '5',
            'X-RateLimit-Remaining': rateLimit.remaining.toString(),
            'X-RateLimit-Reset': rateLimit.resetTime.toString(),
          },
        }
      );
    }

    const body = await request.json();
    
    const validationResult = registerSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input',
            details: validationResult.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const { email, password } = validationResult.data;

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        {
          error: {
            code: 'EMAIL_EXISTS',
            message: 'Email already registered',
          },
        },
        { status: 409 }
      );
    }

    let subdomain = generateSubdomain(email);
    let subdomainExists = true;
    let attempts = 0;

    while (subdomainExists && attempts < 10) {
      const existing = await prisma.user.findUnique({
        where: { subdomain },
      });
      if (!existing) {
        subdomainExists = false;
      } else {
        subdomain = generateSubdomain(email);
        attempts++;
      }
    }

    if (subdomainExists) {
      return NextResponse.json(
        {
          error: {
            code: 'SUBDOMAIN_GENERATION_FAILED',
            message: 'Failed to generate unique subdomain',
          },
        },
        { status: 500 }
      );
    }

    const password_hash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email,
        password_hash,
        subdomain,
      },
    });

    return NextResponse.json(
      {
        id: user.id,
        email: user.email,
        subdomain: user.subdomain,
        createdAt: user.created_at,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        },
      },
      { status: 500 }
    );
  }
}
