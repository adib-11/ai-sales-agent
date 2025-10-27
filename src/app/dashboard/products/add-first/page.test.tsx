import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import AddFirstProductPage from './page';

// Mock the ProductForm component
vi.mock('@/components/features/products/ProductForm', () => ({
  default: () => <div data-testid="product-form">Product Form</div>
}));

describe('AddFirstProductPage', () => {
  it('should render welcome message', () => {
    render(<AddFirstProductPage />);
    
    expect(screen.getByText(/Welcome to AI Sales Agent!/i)).toBeInTheDocument();
  });

  it('should render description text', () => {
    render(<AddFirstProductPage />);
    
    expect(
      screen.getByText(/Adding products to your catalog will enable our AI chatbot/i)
    ).toBeInTheDocument();
  });

  it('should render ProductForm component', () => {
    render(<AddFirstProductPage />);
    
    expect(screen.getByTestId('product-form')).toBeInTheDocument();
  });
});
