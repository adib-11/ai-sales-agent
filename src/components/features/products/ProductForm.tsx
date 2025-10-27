'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CldUploadWidget, type CloudinaryUploadWidgetResults } from 'next-cloudinary';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

interface ProductFormProps {
  onSuccess?: () => void;
}

export default function ProductForm({ onSuccess }: ProductFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    imageUrl: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const handleUploadSuccess = (result: CloudinaryUploadWidgetResults) => {
    if (result.info && typeof result.info !== 'string' && 'secure_url' in result.info) {
      const secureUrl = result.info.secure_url;
      setFormData(prev => ({ ...prev, imageUrl: secureUrl || '' }));
      setUploadError('');
      // Clear any previous image URL error
      setErrors(prev => ({ ...prev, imageUrl: '' }));
    }
  };

  const handleUploadError = () => {
    setUploadError('Failed to upload image. Please try again.');
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Product name is required';
    }
    
    if (!formData.price.trim()) {
      newErrors.price = 'Price is required';
    }
    
    if (!formData.imageUrl) {
      newErrors.imageUrl = 'Please upload a product image';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        if (data.error) {
          setErrors({ submit: data.error.message || 'Failed to create product' });
        } else {
          setErrors({ submit: 'Failed to create product' });
        }
        setIsSubmitting(false);
        return;
      }
      
      // Success! Redirect to products dashboard
      if (onSuccess) {
        onSuccess();
      } else {
        router.push('/dashboard/products?success=Product added successfully');
      }
      
    } catch (error) {
      console.error('Error creating product:', error);
      setErrors({ submit: 'An error occurred. Please try again.' });
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Product Name */}
      <div className="space-y-2">
        <Label htmlFor="name">Product Name *</Label>
        <Input
          id="name"
          type="text"
          placeholder="e.g., Red T-Shirt"
          value={formData.name}
          onChange={(e) => {
            setFormData(prev => ({ ...prev, name: e.target.value }));
            setErrors(prev => ({ ...prev, name: '' }));
          }}
          disabled={isSubmitting}
          className={errors.name ? 'border-red-500' : ''}
        />
        {errors.name && (
          <p className="text-sm text-red-500">{errors.name}</p>
        )}
      </div>

      {/* Price */}
      <div className="space-y-2">
        <Label htmlFor="price">Price *</Label>
        <Input
          id="price"
          type="text"
          placeholder="e.g., 25.00"
          value={formData.price}
          onChange={(e) => {
            setFormData(prev => ({ ...prev, price: e.target.value }));
            setErrors(prev => ({ ...prev, price: '' }));
          }}
          disabled={isSubmitting}
          className={errors.price ? 'border-red-500' : ''}
        />
        {errors.price && (
          <p className="text-sm text-red-500">{errors.price}</p>
        )}
      </div>

      {/* Image Upload */}
      <div className="space-y-2">
        <Label>Product Image *</Label>
        <div className="flex flex-col gap-4">
          <CldUploadWidget
            uploadPreset={process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || ''}
            options={{
              sources: ['local', 'url', 'camera'],
              multiple: false,
              maxFiles: 1,
              folder: 'products',
              resourceType: 'image',
            }}
            onSuccess={handleUploadSuccess}
            onError={handleUploadError}
          >
            {({ open }) => (
              <Button
                type="button"
                variant="outline"
                onClick={() => open()}
                disabled={isSubmitting}
              >
                {formData.imageUrl ? 'Change Image' : 'Upload Image'}
              </Button>
            )}
          </CldUploadWidget>
          
          {uploadError && (
            <p className="text-sm text-red-500">{uploadError}</p>
          )}
          
          {errors.imageUrl && !formData.imageUrl && (
            <p className="text-sm text-red-500">{errors.imageUrl}</p>
          )}
          
          {formData.imageUrl && (
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-gray-600 mb-2">Image preview:</p>
                <div className="relative w-full h-48">
                  <Image
                    src={formData.imageUrl}
                    alt="Product preview"
                    fill
                    className="object-contain rounded-md"
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Submit Error */}
      {errors.submit && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-600">{errors.submit}</p>
        </div>
      )}

      {/* Submit Button */}
      <Button
        type="submit"
        className="w-full"
        disabled={isSubmitting}
      >
        {isSubmitting ? 'Adding Product...' : 'Add Product'}
      </Button>
    </form>
  );
}
