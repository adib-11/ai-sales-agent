import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';

// Validation schema for product input
const productSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  price: z.string().min(1, 'Price is required'),
  imageUrl: z.string().url('Valid image URL is required')
});

export async function POST(request: NextRequest) {
  try {
    // 1. Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // 2. Rate limiting
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const rateLimitKey = `product-create:${session.user.id}:${ip}`;
    const rateLimitResult = checkRateLimit(rateLimitKey, {
      maxRequests: 10,
      windowMs: 60 * 1000 // 1 minute
    });
    
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { 
          error: { 
            code: 'RATE_LIMIT_EXCEEDED', 
            message: 'Too many requests. Please try again later.' 
          } 
        },
        { status: 429 }
      );
    }

    // 3. Parse and validate input
    const body = await request.json();
    const validatedData = productSchema.parse(body);

    // 4. Create product in database
    const product = await prisma.product.create({
      data: {
        user_id: session.user.id,
        name: validatedData.name,
        price: validatedData.price,
        image_url: validatedData.imageUrl
      }
    });

    // 5. Return success response with camelCase fields
    return NextResponse.json({
      id: product.id,
      userId: product.user_id,
      name: product.name,
      price: product.price,
      imageUrl: product.image_url,
      createdAt: product.created_at
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating product:', error);

    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: { 
            code: 'VALIDATION_ERROR', 
            message: 'Invalid input data',
            details: error.issues
          } 
        },
        { status: 400 }
      );
    }

    // Handle other errors
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An error occurred while creating the product' } },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // 1. Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // 2. Get search query parameter
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';

    // 3. Fetch products for the authenticated user
    const products = await prisma.product.findMany({
      where: {
        user_id: session.user.id,
        ...(search && {
          name: {
            contains: search
          }
        })
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    // 4. Return products with camelCase fields
    const productsWithCamelCase = products.map(product => ({
      id: product.id,
      userId: product.user_id,
      name: product.name,
      price: product.price,
      imageUrl: product.image_url,
      createdAt: product.created_at
    }));

    return NextResponse.json(productsWithCamelCase, { status: 200 });

  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An error occurred while fetching products' } },
      { status: 500 }
    );
  }
}
