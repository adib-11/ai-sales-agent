import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Product } from '@/lib/types';

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  return (
    <Card className="overflow-hidden">
      <div className="relative w-full h-48">
        <Image
          src={product.imageUrl}
          alt={product.name}
          fill
          className="object-cover"
        />
      </div>
      <CardHeader>
        <CardTitle className="text-lg">{product.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold text-primary">${product.price}</p>
        <p className="text-sm text-gray-500 mt-2">
          Added {new Date(product.createdAt).toLocaleDateString()}
        </p>
      </CardContent>
    </Card>
  );
}
