import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';
import ProductForm from './ProductForm';

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: vi.fn()
}));

// Mock Cloudinary Upload Widget
vi.mock('next-cloudinary', () => ({
  CldUploadWidget: ({ children, onSuccess }: { children: (helpers: { open: () => void }) => React.ReactNode; onSuccess: (result: { info: { secure_url: string } }) => void }) => {
    return children({
      open: () => {
        // Simulate successful upload
        onSuccess({
          info: {
            secure_url: 'https://cloudinary.com/test-image.jpg'
          }
        });
      }
    });
  }
}));

// Mock fetch
global.fetch = vi.fn();

describe('ProductForm', () => {
  const mockPush = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useRouter).mockReturnValue({
      push: mockPush,
      replace: vi.fn(),
      refresh: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      prefetch: vi.fn(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  });

  it('should render all form fields', () => {
    render(<ProductForm />);

    expect(screen.getByLabelText(/Product Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Price/i)).toBeInTheDocument();
    expect(screen.getByText(/Product Image/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Upload Image/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add Product/i })).toBeInTheDocument();
  });

  it('should show validation errors for empty fields', async () => {
    const user = userEvent.setup();
    render(<ProductForm />);

    const submitButton = screen.getByRole('button', { name: /Add Product/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/Product name is required/i)).toBeInTheDocument();
      expect(screen.getByText(/Price is required/i)).toBeInTheDocument();
      expect(screen.getByText(/Please upload a product image/i)).toBeInTheDocument();
    });
  });

  it('should display image preview after upload', async () => {
    const user = userEvent.setup();
    render(<ProductForm />);

    const uploadButton = screen.getByRole('button', { name: /Upload Image/i });
    await user.click(uploadButton);

    await waitFor(() => {
      expect(screen.getByAltText('Product preview')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Change Image/i })).toBeInTheDocument();
    });
  });

  it('should submit form with valid data', async () => {
    const user = userEvent.setup();
    
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'product-123',
        name: 'Test Product',
        price: '25.00',
        imageUrl: 'https://cloudinary.com/test-image.jpg'
      })
    } as Response);

    render(<ProductForm />);

    // Fill in form
    await user.type(screen.getByLabelText(/Product Name/i), 'Test Product');
    await user.type(screen.getByLabelText(/Price/i), '25.00');
    
    // Upload image
    await user.click(screen.getByRole('button', { name: /Upload Image/i }));

    // Submit form
    await user.click(screen.getByRole('button', { name: /Add Product/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/products',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            name: 'Test Product',
            price: '25.00',
            imageUrl: 'https://cloudinary.com/test-image.jpg'
          })
        })
      );
    });
  });

  it('should redirect to products dashboard on success', async () => {
    const user = userEvent.setup();
    
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'product-123'
      })
    } as Response);

    render(<ProductForm />);

    await user.type(screen.getByLabelText(/Product Name/i), 'Test Product');
    await user.type(screen.getByLabelText(/Price/i), '25.00');
    await user.click(screen.getByRole('button', { name: /Upload Image/i }));
    await user.click(screen.getByRole('button', { name: /Add Product/i }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        expect.stringContaining('/dashboard/products')
      );
    });
  });

  it('should display error message on API failure', async () => {
    const user = userEvent.setup();
    
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        error: {
          message: 'Failed to create product'
        }
      })
    } as Response);

    render(<ProductForm />);

    await user.type(screen.getByLabelText(/Product Name/i), 'Test Product');
    await user.type(screen.getByLabelText(/Price/i), '25.00');
    await user.click(screen.getByRole('button', { name: /Upload Image/i }));
    await user.click(screen.getByRole('button', { name: /Add Product/i }));

    await waitFor(() => {
      expect(screen.getByText(/Failed to create product/i)).toBeInTheDocument();
    });
  });

  it('should show loading state during submission', async () => {
    const user = userEvent.setup();
    
    vi.mocked(global.fetch).mockImplementationOnce(
      () => new Promise(resolve => setTimeout(() => resolve({
        ok: true,
        json: async () => ({ id: 'product-123' })
      } as Response), 100))
    );

    render(<ProductForm />);

    await user.type(screen.getByLabelText(/Product Name/i), 'Test Product');
    await user.type(screen.getByLabelText(/Price/i), '25.00');
    await user.click(screen.getByRole('button', { name: /Upload Image/i }));
    await user.click(screen.getByRole('button', { name: /Add Product/i }));

    expect(screen.getByText(/Adding Product.../i)).toBeInTheDocument();
  });
});
