/**
 * Utility functions
 * Shared utilities across the application
 */

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind CSS classes
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format currency
 */
export function formatCurrency(
  amount: number | string,
  locale: string = 'en',
  currency: string = 'IQD'
): string {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(numAmount);
}

/**
 * Format date
 */
export function formatDate(
  date: Date | string,
  locale: string = 'en',
  options?: Intl.DateTimeFormatOptions
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, options).format(dateObj);
}

/**
 * Generate invoice number
 */
export function generateInvoiceNumber(prefix: string = 'INV', year?: number): string {
  const currentYear = year || new Date().getFullYear();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}-${currentYear}-${random}`;
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };
    
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Check if user has permission
 */
export function hasPermission(
  userPermissions: string[],
  requiredPermission: string
): boolean {
  return userPermissions.includes(requiredPermission) || 
         userPermissions.includes('*'); // Wildcard for full access
}

/**
 * Generate random 4-digit customer code (1000-9999)
 */
export function generateSkuCode(): string {
  // Generate a random number between 1000 and 9999
  const min = 1000;
  const max = 9999;
  const code = Math.floor(Math.random() * (max - min + 1)) + min;
  return code.toString();
}

/**
 * Generate random 6-character alphanumeric code for products/motorcycles (A-Z, 0-9)
 */
export function generateProductSkuCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

