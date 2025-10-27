import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST, GET } from './route';
import { NextRequest } from 'next/server';

// Mock dependencies
vi.mock('@/lib/auth', () => ({
  auth: vi.fn()
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    product: {
      create: vi.fn(),
      findMany: vi.fn()
    }
  }
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn()
}));

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { checkRateLimit } from '@/lib/rate-limit';

describe('POST /api/products', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a product successfully', async () => {
    // Mock auth
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-123', email: 'test@example.com' },
      expires: '2025-12-31'
    });

    // Mock rate limit
    vi.mocked(checkRateLimit).mockReturnValue({
      allowed: true,
      remaining: 9,
      resetTime: Date.now() + 60000
    });

    // Mock product creation
    const mockProduct = {
      id: 'product-123',
      user_id: 'user-123',
      name: 'Test Product',
      price: '25.00',
      image_url: 'https://cloudinary.com/image.jpg',
      created_at: new Date()
    };
    vi.mocked(prisma.product.create).mockResolvedValue(mockProduct);

    const request = new NextRequest('http://localhost:3000/api/products', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test Product',
        price: '25.00',
        imageUrl: 'https://cloudinary.com/image.jpg'
      })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data).toMatchObject({
      id: 'product-123',
      userId: 'user-123',
      name: 'Test Product',
      price: '25.00',
      imageUrl: 'https://cloudinary.com/image.jpg'
    });
  });

  it('should return 401 if not authenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/api/products', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test Product',
        price: '25.00',
        imageUrl: 'https://cloudinary.com/image.jpg'
      })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('should return 400 for empty product name', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-123', email: 'test@example.com' },
      expires: '2025-12-31'
    });

    vi.mocked(checkRateLimit).mockReturnValue({
      allowed: true,
      remaining: 9,
      resetTime: Date.now() + 60000
    });

    const request = new NextRequest('http://localhost:3000/api/products', {
      method: 'POST',
      body: JSON.stringify({
        name: '',
        price: '25.00',
        imageUrl: 'https://cloudinary.com/image.jpg'
      })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 for empty price', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-123', email: 'test@example.com' },
      expires: '2025-12-31'
    });

    vi.mocked(checkRateLimit).mockReturnValue({
      allowed: true,
      remaining: 9,
      resetTime: Date.now() + 60000
    });

    const request = new NextRequest('http://localhost:3000/api/products', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test Product',
        price: '',
        imageUrl: 'https://cloudinary.com/image.jpg'
      })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 for invalid image URL', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-123', email: 'test@example.com' },
      expires: '2025-12-31'
    });

    vi.mocked(checkRateLimit).mockReturnValue({
      allowed: true,
      remaining: 9,
      resetTime: Date.now() + 60000
    });

    const request = new NextRequest('http://localhost:3000/api/products', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test Product',
        price: '25.00',
        imageUrl: 'not-a-url'
      })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });

  it('should link product to correct user', async () => {
    const userId = 'user-456';
    vi.mocked(auth).mockResolvedValue({
      user: { id: userId, email: 'test@example.com' },
      expires: '2025-12-31'
    });

    vi.mocked(checkRateLimit).mockReturnValue({
      allowed: true,
      remaining: 9,
      resetTime: Date.now() + 60000
    });

    const mockProduct = {
      id: 'product-123',
      user_id: userId,
      name: 'Test Product',
      price: '25.00',
      image_url: 'https://cloudinary.com/image.jpg',
      created_at: new Date()
    };
    vi.mocked(prisma.product.create).mockResolvedValue(mockProduct);

    const request = new NextRequest('http://localhost:3000/api/products', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test Product',
        price: '25.00',
        imageUrl: 'https://cloudinary.com/image.jpg'
      })
    });

    await POST(request);

    expect(prisma.product.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        user_id: userId
      })
    });
  });

  it('should return 429 when rate limit exceeded', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-123', email: 'test@example.com' },
      expires: '2025-12-31'
    });

    vi.mocked(checkRateLimit).mockReturnValue({
      allowed: false,
      remaining: 0,
      resetTime: Date.now() + 60000
    });

    const request = new NextRequest('http://localhost:3000/api/products', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test Product',
        price: '25.00',
        imageUrl: 'https://cloudinary.com/image.jpg'
      })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.error.code).toBe('RATE_LIMIT_EXCEEDED');
  });
});

describe('GET /api/products', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch products for authenticated user', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-123', email: 'test@example.com' },
      expires: '2025-12-31'
    });

    const mockProducts = [
      {
        id: 'product-1',
        user_id: 'user-123',
        name: 'Product 1',
        price: '25.00',
        image_url: 'https://cloudinary.com/image1.jpg',
        created_at: new Date()
      },
      {
        id: 'product-2',
        user_id: 'user-123',
        name: 'Product 2',
        price: '35.00',
        image_url: 'https://cloudinary.com/image2.jpg',
        created_at: new Date()
      }
    ];
    vi.mocked(prisma.product.findMany).mockResolvedValue(mockProducts);

    const request = new NextRequest('http://localhost:3000/api/products');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveLength(2);
    expect(data[0].name).toBe('Product 1');
    expect(data[1].name).toBe('Product 2');
  });

  it('should return 401 if not authenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/api/products');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('should filter products by search query', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-123', email: 'test@example.com' },
      expires: '2025-12-31'
    });

    vi.mocked(prisma.product.findMany).mockResolvedValue([]);

    const request = new NextRequest('http://localhost:3000/api/products?search=shirt');
    await GET(request);

    expect(prisma.product.findMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        name: { contains: 'shirt' }
      }),
      orderBy: { created_at: 'desc' }
    });
  });
});
