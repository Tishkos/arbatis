/**
 * Next.js Middleware
 * Handles i18n routing and authentication
 * MAXIMUM SECURITY: All routes protected except login/signup/forgot-password
 * 
 * IMPORTANT: This file MUST be in the root directory (not src/) for Next.js to recognize it
 */

import createMiddleware from 'next-intl/middleware';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

// Create i18n middleware
const intlMiddleware = createMiddleware({
  locales: ['ku', 'en', 'ar'],
  defaultLocale: 'ku',
  localePrefix: 'always',
});

// ONLY these routes are public (no authentication required)
const publicRoutes = ['/login', '/signup', '/forgot-password', '/otp'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for API routes, static files, and Next.js internals
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Extract locale from pathname first
  const pathnameHasLocale = /^\/(ku|en|ar)(\/|$)/.test(pathname);
  if (!pathnameHasLocale) {
    // Let next-intl middleware handle locale routing
    return intlMiddleware(request);
  }

  // Extract path without locale
  const pathWithoutLocale = pathname.replace(/^\/(ku|en|ar)/, '') || '/';
  const locale = pathname.match(/^\/(ku|en|ar)/)?.[1] || 'ku';

  // Check if this is a public route
  const isPublicRoute = publicRoutes.includes(pathWithoutLocale);
  
  // SECURITY: Protect ALL routes except public ones
  // This includes: /dashboard, /products, /motorcycles, /sales, /invoices, /customers, /employees, etc.
  if (!isPublicRoute) {
    try {
      const token = await getToken({
        req: request,
        secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
      });

      if (!token) {
        // No token found - redirect to login
        const loginUrl = new URL(`/${locale}/login`, request.url);
        loginUrl.searchParams.set('callbackUrl', pathname);
        return NextResponse.redirect(loginUrl);
      }

      // Token exists - user is authenticated, allow access
    } catch (error) {
      // If auth check fails, redirect to login (security first)
      console.error('[Middleware] Auth check failed:', error);
      const loginUrl = new URL(`/${locale}/login`, request.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Redirect authenticated users away from auth pages (UX improvement)
  if (isPublicRoute) {
    try {
      const token = await getToken({
        req: request,
        secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
      });

      if (token) {
        // User is authenticated, redirect to dashboard
        return NextResponse.redirect(new URL(`/${locale}/dashboard`, request.url));
      }
    } catch (error) {
      // If auth check fails, allow access to public route (allow login/signup)
      // Silent fail for public routes
    }
  }

  // Let next-intl middleware handle the rest
  return intlMiddleware(request);
}

export const config = {
  matcher: [
    // Match all routes except API, static files, and Next.js internals
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
