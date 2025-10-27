'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import ProductCard from './ProductCard';
import ProductForm from './ProductForm';
import ProductSearchBar from './ProductSearchBar';
import type { Product } from '@/lib/types';
import { Copy, Check } from 'lucide-react';

interface ProductsDashboardProps {
  initialProducts: Product[];
  subdomain: string;
  successMessage?: string;
}

export default function ProductsDashboard({ 
  initialProducts, 
  subdomain,
  successMessage 
}: ProductsDashboardProps) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  // Filter products based on search query (client-side filtering)
  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Generate public shop URL
  const publicShopUrl = subdomain 
    ? `https://${subdomain}.shopbot.com` 
    : '';

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicShopUrl);
      setCopied(true);
      toast({
        title: 'Link copied!',
        description: 'Your shop link has been copied to clipboard',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      toast({
        title: 'Copy failed',
        description: 'Please copy the link manually',
        variant: 'destructive',
      });
    }
  };

  const handleProductAdded = () => {
    // Close modal
    setIsModalOpen(false);
    
    // Show success toast
    toast({
      title: 'Product added!',
      description: 'Your product has been added successfully',
    });
    
    // Refresh products by fetching from API
    fetchProducts();
  };

  const fetchProducts = async () => {
    try {
      const response = await fetch('/api/products');
      if (response.ok) {
        const data = await response.json();
        setProducts(data);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Add Product Button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Products</h1>
          <p className="text-gray-600 mt-1">Manage your product catalog</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} size="lg">
          + Add Another Product
        </Button>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="text-sm text-green-600">{successMessage}</p>
        </div>
      )}

      {/* Public Shop Link */}
      {publicShopUrl && (
        <Card>
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold mb-2">Your Public Shop Link</h2>
            <p className="text-sm text-gray-600 mb-3">
              Share this link with your customers to let them browse your products
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={publicShopUrl}
                readOnly
                className="flex-1 px-3 py-2 border rounded-md bg-gray-50 text-sm"
              />
              <Button 
                onClick={handleCopyLink}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search Bar */}
      <ProductSearchBar 
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* Products Grid or Empty State */}
      {products.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <h2 className="text-xl font-semibold text-gray-700">No products yet</h2>
          <p className="text-gray-500 mt-2">Add your first product to get started</p>
          <Button onClick={() => setIsModalOpen(true)} className="mt-4">
            Add Your First Product
          </Button>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <h2 className="text-xl font-semibold text-gray-700">No products found</h2>
          <p className="text-gray-500 mt-2">Try a different search term</p>
          <Button onClick={() => setSearchQuery('')} variant="outline" className="mt-4">
            Clear Search
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {/* Add Product Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Product</DialogTitle>
          </DialogHeader>
          <ProductForm onSuccess={handleProductAdded} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
