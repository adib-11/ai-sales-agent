import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import ProductForm from '@/components/features/products/ProductForm';

export const dynamic = 'force-dynamic';

export default function AddFirstProductPage() {
  return (
    <div className="flex min-h-[calc(100vh-200px)] items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-3xl">
            Welcome to AI Sales Agent! 🎉
          </CardTitle>
          <CardDescription>
            You&apos;re all set up! Let&apos;s add your first product to get
            started.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-gray-600">
            Adding products to your catalog will enable our AI chatbot to help
            customers discover and purchase items from your store.
          </p>
          
          <ProductForm />
        </CardContent>
      </Card>
    </div>
  );
}
