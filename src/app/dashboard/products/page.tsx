import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import ProductsDashboard from '@/components/features/products/ProductsDashboard';

export default async function ProductsPage({
  searchParams
}: {
  searchParams: { success?: string };
}) {
  const session = await auth();
  
  if (!session?.user?.id) {
    redirect('/login');
  }

  // Fetch user for subdomain
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { subdomain: true }
  });

  // Fetch products for the authenticated user
  const products = await prisma.product.findMany({
    where: {
      user_id: session.user.id
    },
    orderBy: {
      created_at: 'desc'
    }
  });

  // Convert to frontend-safe format
  const productsWithSerializableDates = products.map(product => ({
    id: product.id,
    userId: product.user_id,
    name: product.name,
    price: product.price,
    imageUrl: product.image_url,
    createdAt: new Date(product.created_at)
  }));

  return (
    <ProductsDashboard 
      initialProducts={productsWithSerializableDates}
      subdomain={user?.subdomain || ''}
      successMessage={searchParams.success}
    />
  );
}
