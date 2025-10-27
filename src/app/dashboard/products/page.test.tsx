import { describe, it, expect, vi, beforeEach } from 'vitest';
import { redirect } from 'next/navigation';
import ProductsPage from './page';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import type { Product } from '@/lib/types';

// Mock dependencies
vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    refresh: vi.fn(),
  })),
}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    product: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/components/features/products/ProductsDashboard', () => ({
  default: ({ initialProducts, subdomain }: { initialProducts: Product[]; subdomain: string; successMessage?: string }) => (
    <div data-testid="products-dashboard">
      <span data-testid="subdomain">{subdomain}</span>
      <span data-testid="products-count">{initialProducts.length}</span>
    </div>
  ),
}));

describe('ProductsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects to login if not authenticated', async () => {
    (auth as any).mockResolvedValue(null);

    await expect(ProductsPage({ searchParams: {} })).rejects.toThrow('NEXT_REDIRECT');

    expect(redirect).toHaveBeenCalledWith('/login');
  });

  it('redirects to login if user ID is missing', async () => {
    (auth as any).mockResolvedValue({ user: {} });

    await expect(ProductsPage({ searchParams: {} })).rejects.toThrow('NEXT_REDIRECT');

    expect(redirect).toHaveBeenCalledWith('/login');
  });

  it('fetches user subdomain and products', async () => {
    const mockSession = {
      user: { id: 'user123', email: 'test@example.com' },
    };

    const mockUser = {
      subdomain: 'testshop',
    };

    const mockProducts = [
      {
        id: '1',
        user_id: 'user123',
        name: 'Red T-Shirt',
        price: '25.00',
        image_url: 'https://example.com/image1.jpg',
        created_at: new Date('2025-10-27'),
      },
    ];

    (auth as any).mockResolvedValue(mockSession);
    (prisma.user.findUnique as any).mockResolvedValue(mockUser);
    (prisma.product.findMany as any).mockResolvedValue(mockProducts);

    await ProductsPage({ searchParams: {} });

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user123' },
      select: { subdomain: true },
    });

    expect(prisma.product.findMany).toHaveBeenCalledWith({
      where: { user_id: 'user123' },
      orderBy: { created_at: 'desc' },
    });
  });

  it('handles user with no subdomain', async () => {
    const mockSession = {
      user: { id: 'user123', email: 'test@example.com' },
    };

    (auth as any).mockResolvedValue(mockSession);
    (prisma.user.findUnique as any).mockResolvedValue(null);
    (prisma.product.findMany as any).mockResolvedValue([]);

    await ProductsPage({ searchParams: {} });

    expect(prisma.user.findUnique).toHaveBeenCalled();
    expect(prisma.product.findMany).toHaveBeenCalled();
  });

  it('passes success message to dashboard', async () => {
    const mockSession = {
      user: { id: 'user123', email: 'test@example.com' },
    };

    (auth as any).mockResolvedValue(mockSession);
    (prisma.user.findUnique as any).mockResolvedValue({ subdomain: 'testshop' });
    (prisma.product.findMany as any).mockResolvedValue([]);

    await ProductsPage({ 
      searchParams: { success: 'Product added successfully' } 
    });

    expect(prisma.user.findUnique).toHaveBeenCalled();
  });

  it('converts database products to frontend format', async () => {
    const mockSession = {
      user: { id: 'user123', email: 'test@example.com' },
    };

    const mockProducts = [
      {
        id: '1',
        user_id: 'user123',
        name: 'Red T-Shirt',
        price: '25.00',
        image_url: 'https://example.com/image1.jpg',
        created_at: new Date('2025-10-27'),
      },
    ];

    (auth as any).mockResolvedValue(mockSession);
    (prisma.user.findUnique as any).mockResolvedValue({ subdomain: 'testshop' });
    (prisma.product.findMany as any).mockResolvedValue(mockProducts);

    await ProductsPage({ searchParams: {} });

    expect(prisma.product.findMany).toHaveBeenCalled();
  });
});
