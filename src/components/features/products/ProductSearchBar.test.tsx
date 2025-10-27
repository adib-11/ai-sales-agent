import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProductSearchBar from './ProductSearchBar';

describe('ProductSearchBar', () => {
  it('renders search input', () => {
    const onSearchChange = vi.fn();
    render(<ProductSearchBar searchQuery="" onSearchChange={onSearchChange} />);
    
    expect(screen.getByPlaceholderText('Search products...')).toBeInTheDocument();
  });

  it('displays current search query', () => {
    const onSearchChange = vi.fn();
    render(<ProductSearchBar searchQuery="test query" onSearchChange={onSearchChange} />);
    
    const input = screen.getByPlaceholderText('Search products...') as HTMLInputElement;
    expect(input.value).toBe('test query');
  });

  it('calls onSearchChange when typing', async () => {
    const user = userEvent.setup();
    const onSearchChange = vi.fn();
    render(<ProductSearchBar searchQuery="" onSearchChange={onSearchChange} />);
    
    const input = screen.getByPlaceholderText('Search products...');
    await user.type(input, 'shirt');
    
    expect(onSearchChange).toHaveBeenCalled();
  });

  it('shows clear button when search query is not empty', () => {
    const onSearchChange = vi.fn();
    render(<ProductSearchBar searchQuery="test" onSearchChange={onSearchChange} />);
    
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('does not show clear button when search query is empty', () => {
    const onSearchChange = vi.fn();
    render(<ProductSearchBar searchQuery="" onSearchChange={onSearchChange} />);
    
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('clears search when clear button is clicked', async () => {
    const user = userEvent.setup();
    const onSearchChange = vi.fn();
    render(<ProductSearchBar searchQuery="test query" onSearchChange={onSearchChange} />);
    
    const clearButton = screen.getByRole('button');
    await user.click(clearButton);
    
    expect(onSearchChange).toHaveBeenCalledWith('');
  });
});
