import { getRequestConfig } from 'next-intl/server';
import { config } from '@/lib/config';
import { notFound } from 'next/navigation';

export default getRequestConfig(async ({ locale }) => {
  // Validate locale
  if (!locale || !config.i18n.locales.includes(locale as any)) {
    locale = config.i18n.defaultLocale;
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
