import { redirect } from 'next/navigation';

export default function LegacyAddFirstProductPage() {
  redirect('/dashboard/products/add-first');
}
