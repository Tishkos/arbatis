/**
 * Locale Layout
 * Handles i18n for each locale
 * NOTE: DO NOT include <html> or <body> here - that's in root app/layout.tsx
 * DO NOT import globals.css here - that's in root app/layout.tsx
 * 
 * This layout is REQUIRED for next-intl to work with [locale] routes
 */

import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { getTextDirection } from '@/lib/i18n';
import { notFound } from 'next/navigation';
import { config } from '@/lib/config';

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>; // Next.js 16: params IS a Promise
}) {
  const { locale } = await params; // Must await in Next.js 16
  
  // Validate locale
  if (!config.i18n.locales.includes(locale as any)) {
    notFound();
  }
  
  const direction = getTextDirection(locale as 'ku' | 'en' | 'ar');
  
  // Get messages for this locale
  const messages = await getMessages({ locale });

  // Set font class based on locale
  const fontClass = locale === 'ku' ? 'font-kurdish' : 'font-engar';

  return (
    <div dir={direction} lang={locale} className={fontClass} suppressHydrationWarning>
      <NextIntlClientProvider messages={messages}>
        {children}
      </NextIntlClientProvider>
    </div>
  );
}

