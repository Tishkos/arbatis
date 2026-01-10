/**
 * Application configuration
 * Centralized config with environment variables
 */

export const config = {
  // App
  appName: 'Arbati',
  appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  environment: process.env.NODE_ENV || 'development',
  
  // Database
  databaseUrl: process.env.DATABASE_URL!,
  
  // Auth
  auth: {
    secret: process.env.AUTH_SECRET!,
    jwtSecret: process.env.JWT_SECRET!,
    nextAuthUrl: process.env.NEXTAUTH_URL || 'http://localhost:3000',
  },
  
  // Email
  email: {
    provider: process.env.EMAIL_PROVIDER || 'smtp',
    smtp: {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER,
      password: process.env.SMTP_PASSWORD,
    },
    from: process.env.EMAIL_FROM || 'noreply@arbati.com',
    approvalEmail: process.env.APPROVAL_EMAIL || 'admin@arbati.com',
  },
  
  // i18n
  i18n: {
    defaultLocale: process.env.DEFAULT_LOCALE || 'ku',
    locales: ['ku', 'en', 'ar'] as const, // Kurdish as default
  },
  
  // Features
  features: {
    enableEmailNotifications: process.env.ENABLE_EMAIL_NOTIFICATIONS === 'true',
    enableLowStockAlerts: process.env.ENABLE_LOW_STOCK_ALERTS === 'true',
    enableAuditLogging: process.env.ENABLE_AUDIT_LOGGING !== 'false',
  },
  
  // Pagination
  pagination: {
    defaultPageSize: 20,
    maxPageSize: 100,
  },
} as const;

// Type helpers
export type Locale = typeof config.i18n.locales[number];

