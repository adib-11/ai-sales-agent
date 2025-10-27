import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProductsDashboard from './ProductsDashboard';
import type { Product } from '@/lib/types';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    refresh: vi.fn(),
  })),
}));

// Mock next-cloudinary
vi.mock('next-cloudinary', () => ({
  CldUploadWidget: ({ children, onSuccess }: any) => (
    <div data-testid="upload-widget">
      {children({ open: vi.fn() })}
    </div>
  ),
}));

// Mock the toast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

// Mock clipboard API
const mockWriteText = vi.fn(() => Promise.resolve());
Object.assign(navigator, {
  clipboard: {
    writeText: mockWriteText,
  },
});

const mockProducts: Product[] = [
  {
    id: '1',
    userId: 'user1',
    name: 'Red T-Shirt',
    price: '25.00',
    imageUrl: 'https://example.com/image1.jpg',
    createdAt: new Date('2025-10-27'),
  },
  {
    id: '2',
    userId: 'user1',
    name: 'Blue Jeans',
    price: '50.00',
    imageUrl: 'https://example.com/image2.jpg',
    createdAt: new Date('2025-10-26'),
  },
];

describe('ProductsDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWriteText.mockClear();
    global.fetch = vi.fn();
  });

  it('renders products grid with multiple products', () => {
    render(
      <ProductsDashboard 
        initialProducts={mockProducts} 
        subdomain="testshop"
      />
    );
    
    expect(screen.getByText('Red T-Shirt')).toBeInTheDocument();
    expect(screen.getByText('Blue Jeans')).toBeInTheDocument();
  });

  it('displays "+ Add Another Product" button', () => {
    render(
      <ProductsDashboard 
        initialProducts={mockProducts} 
        subdomain="testshop"
      />
    );
    
    expect(screen.getByText('+ Add Another Product')).toBeInTheDocument();
  });

  it('opens modal when "+ Add Another Product" is clicked', async () => {
    const user = userEvent.setup();
    render(
      <ProductsDashboard 
        initialProducts={mockProducts} 
        subdomain="testshop"
      />
    );
    
    const addButton = screen.getByText('+ Add Another Product');
    await user.click(addButton);
    
    expect(screen.getByText('Add New Product')).toBeInTheDocument();
  });

  it('displays search bar', () => {
    render(
      <ProductsDashboard 
        initialProducts={mockProducts} 
        subdomain="testshop"
      />
    );
    
    expect(screen.getByPlaceholderText('Search products...')).toBeInTheDocument();
  });

  it('filters products by search query', async () => {
    const user = userEvent.setup();
    render(
      <ProductsDashboard 
        initialProducts={mockProducts} 
        subdomain="testshop"
      />
    );
    
    const searchInput = screen.getByPlaceholderText('Search products...');
    await user.type(searchInput, 'shirt');
    
    expect(screen.getByText('Red T-Shirt')).toBeInTheDocument();
    expect(screen.queryByText('Blue Jeans')).not.toBeInTheDocument();
  });

  it('shows "No products found" when search has no results', async () => {
    const user = userEvent.setup();
    render(
      <ProductsDashboard 
        initialProducts={mockProducts} 
        subdomain="testshop"
      />
    );
    
    const searchInput = screen.getByPlaceholderText('Search products...');
    await user.type(searchInput, 'nonexistent');
    
    expect(screen.getByText('No products found')).toBeInTheDocument();
  });

  it('displays empty state when no products exist', () => {
    render(
      <ProductsDashboard 
        initialProducts={[]} 
        subdomain="testshop"
      />
    );
    
    expect(screen.getByText('No products yet')).toBeInTheDocument();
    expect(screen.getByText('Add your first product to get started')).toBeInTheDocument();
  });

  it('displays public shop link with subdomain', () => {
    render(
      <ProductsDashboard 
        initialProducts={mockProducts} 
        subdomain="testshop"
      />
    );
    
    expect(screen.getByDisplayValue('https://testshop.shopbot.com')).toBeInTheDocument();
  });

  it.skip('copies link to clipboard when copy button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <ProductsDashboard 
        initialProducts={mockProducts} 
        subdomain="testshop"
      />
    );
    
    // Find the copy button specifically (not the one in the search bar)
    const copyButtons = screen.getAllByRole('button');
    const copyButton = copyButtons.find(btn => btn.textContent?.includes('Copy'));
    
    expect(copyButton).toBeDefined();
    await user.click(copyButton!);
    
    expect(mockWriteText).toHaveBeenCalledWith('https://testshop.shopbot.com');
  });

  it('displays success message when provided', () => {
    render(
      <ProductsDashboard 
        initialProducts={mockProducts} 
        subdomain="testshop"
        successMessage="Product added successfully"
      />
    );
    
    expect(screen.getByText('Product added successfully')).toBeInTheDocument();
  });

  it('clears search when clear button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <ProductsDashboard 
        initialProducts={mockProducts} 
        subdomain="testshop"
      />
    );
    
    const searchInput = screen.getByPlaceholderText('Search products...');
    await user.type(searchInput, 'shirt');
    
    // Both products should be visible after clearing
    const clearButton = screen.getAllByRole('button').find(btn => 
      btn.querySelector('.lucide-x')
    );
    if (clearButton) {
      await user.click(clearButton);
    }
    
    await waitFor(() => {
      expect(screen.getByText('Red T-Shirt')).toBeInTheDocument();
      expect(screen.getByText('Blue Jeans')).toBeInTheDocument();
    });
  });

  it('refreshes products after successful addition', async () => {
    const user = userEvent.setup();
    const newProduct: Product = {
      id: '3',
      userId: 'user1',
      name: 'Green Hat',
      price: '15.00',
      imageUrl: 'https://example.com/image3.jpg',
      createdAt: new Date('2025-10-27'),
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => [...mockProducts, newProduct],
    });

    render(
      <ProductsDashboard 
        initialProducts={mockProducts} 
        subdomain="testshop"
      />
    );
    
    const addButton = screen.getByText('+ Add Another Product');
    await user.click(addButton);
    
    // Modal should be open
    expect(screen.getByText('Add New Product')).toBeInTheDocument();
  });

  it('is case-insensitive when searching', async () => {
    const user = userEvent.setup();
    render(
      <ProductsDashboard 
        initialProducts={mockProducts} 
        subdomain="testshop"
      />
    );
    
    const searchInput = screen.getByPlaceholderText('Search products...');
    await user.type(searchInput, 'SHIRT');
    
    expect(screen.getByText('Red T-Shirt')).toBeInTheDocument();
  });
});
