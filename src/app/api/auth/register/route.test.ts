import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { prisma } from '@/lib/db';
import * as authLib from '@/lib/auth';

vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  hashPassword: vi.fn(),
}));

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a user successfully', async () => {
    const mockUser = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      email: 'test@example.com',
      password_hash: 'hashed_password',
      subdomain: 'test-abc12',
      created_at: new Date('2025-10-26T12:00:00Z'),
    };

    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);
    vi.mocked(authLib.hashPassword).mockResolvedValueOnce('hashed_password');
    vi.mocked(prisma.user.create).mockResolvedValueOnce(mockUser);

    const request = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'password123',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data).toHaveProperty('id');
    expect(data).toHaveProperty('email', 'test@example.com');
    expect(data).toHaveProperty('subdomain');
    expect(data).not.toHaveProperty('password_hash');
  });

  it('should reject duplicate email', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: '123',
      email: 'test@example.com',
      password_hash: 'hash',
      subdomain: 'test',
      created_at: new Date(),
    });

    const request = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'password123',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toHaveProperty('code', 'EMAIL_EXISTS');
  });

  it('should validate email format', async () => {
    const request = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'invalid-email',
        password: 'password123',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toHaveProperty('code', 'VALIDATION_ERROR');
  });

  it('should validate password length', async () => {
    const request = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'short',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toHaveProperty('code', 'VALIDATION_ERROR');
  });
});
