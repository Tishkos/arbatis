/**
 * i18n Configuration
 * Internationalization setup for next-intl
 */

import { getRequestConfig } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { config } from './config';

// Supported locales
export const locales = config.i18n.locales;
export type Locale = (typeof locales)[number];

export default getRequestConfig(async ({ locale }) => {
  // Validate that the incoming `locale` parameter is valid
  if (!locales.includes(locale as Locale)) {
    notFound();
  }

  return {
    locale: locale as Locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});

/**
 * Get text direction for locale
 */
export function getTextDirection(locale: Locale): 'ltr' | 'rtl' {
  // Kurdish and Arabic both use RTL
  return locale === 'ar' || locale === 'ku' ? 'rtl' : 'ltr';
}

/**
 * Get locale from URL or default
 */
export function getLocale(locale?: string): Locale {
  if (locale && locales.includes(locale as Locale)) {
    return locale as Locale;
  }
  return config.i18n.defaultLocale as Locale;
}

