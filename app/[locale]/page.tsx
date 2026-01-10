import { redirect } from 'next/navigation';

export default async function LocaleHomePage({
  params,
}: {
  params: Promise<{ locale: string }>; // Next.js 16: params IS a Promise
}) {
  const { locale } = await params; // Must await in Next.js 16
  // Redirect to login - middleware will handle authenticated redirects
  redirect(`/${locale}/login`);
}
