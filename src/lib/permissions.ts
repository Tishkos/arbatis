/**
 * Permission Utilities
 * Authorization and permission checking
 */

import { UserRole } from '@prisma/client';

export const PERMISSIONS = {
  // User management
  USERS_APPROVE: 'users:approve',
  USERS_VIEW: 'users:view',
  USERS_EDIT: 'users:edit',
  USERS_DELETE: 'users:delete',

  // Product management
  PRODUCTS_VIEW: 'products:view',
  PRODUCTS_CREATE: 'products:create',
  PRODUCTS_EDIT: 'products:edit',
  PRODUCTS_DELETE: 'products:delete',
  PRICES_EDIT: 'prices:edit',

  // Stock management
  STOCK_VIEW: 'stock:view',
  STOCK_ADJUST: 'stock:adjust',

  // Sales
  SALES_VIEW: 'sales:view',
  SALES_CREATE: 'sales:create',
  SALES_EDIT: 'sales:edit',
  SALES_DELETE: 'sales:delete',

  // Drafts
  DRAFTS_VIEW: 'drafts:view',
  DRAFTS_CREATE: 'drafts:create',
  DRAFTS_EDIT: 'drafts:edit',
  DRAFTS_DELETE: 'drafts:delete',

  // Invoices
  INVOICES_VIEW: 'invoices:view',
  INVOICES_CREATE: 'invoices:create',
  INVOICES_EDIT: 'invoices:edit',
  INVOICES_DELETE: 'invoices:delete',
  INVOICES_CANCEL: 'invoices:cancel',

  // Customers
  CUSTOMERS_VIEW: 'customers:view',
  CUSTOMERS_CREATE: 'customers:create',
  CUSTOMERS_EDIT: 'customers:edit',
  CUSTOMERS_DELETE: 'customers:delete',

  // Employees
  EMPLOYEES_VIEW: 'employees:view',
  EMPLOYEES_CREATE: 'employees:create',
  EMPLOYEES_EDIT: 'employees:edit',
  EMPLOYEES_DELETE: 'employees:delete',
  EMPLOYEES_MANAGE: 'employees:manage',

  // Reports
  REPORTS_VIEW: 'reports:view',
  REPORTS_EXPORT: 'reports:export',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS] | '*';

/**
 * Default permissions for each role
 */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  DEVELOPER: ['*'], // All permissions
  ADMIN: [
    PERMISSIONS.USERS_APPROVE,
    PERMISSIONS.USERS_VIEW,
    PERMISSIONS.USERS_EDIT,
    PERMISSIONS.PRODUCTS_VIEW,
    PERMISSIONS.PRODUCTS_CREATE,
    PERMISSIONS.PRODUCTS_EDIT,
    PERMISSIONS.PRODUCTS_DELETE,
    PERMISSIONS.PRICES_EDIT,
    PERMISSIONS.STOCK_VIEW,
    PERMISSIONS.STOCK_ADJUST,
    PERMISSIONS.SALES_VIEW,
    PERMISSIONS.SALES_CREATE,
    PERMISSIONS.SALES_EDIT,
    PERMISSIONS.SALES_DELETE,
    PERMISSIONS.DRAFTS_VIEW,
    PERMISSIONS.DRAFTS_CREATE,
    PERMISSIONS.DRAFTS_EDIT,
    PERMISSIONS.DRAFTS_DELETE,
    PERMISSIONS.INVOICES_VIEW,
    PERMISSIONS.INVOICES_CREATE,
    PERMISSIONS.INVOICES_EDIT,
    PERMISSIONS.INVOICES_DELETE,
    PERMISSIONS.INVOICES_CANCEL,
    PERMISSIONS.CUSTOMERS_VIEW,
    PERMISSIONS.CUSTOMERS_CREATE,
    PERMISSIONS.CUSTOMERS_EDIT,
    PERMISSIONS.CUSTOMERS_DELETE,
    PERMISSIONS.EMPLOYEES_VIEW,
    PERMISSIONS.EMPLOYEES_CREATE,
    PERMISSIONS.EMPLOYEES_EDIT,
    PERMISSIONS.EMPLOYEES_DELETE,
    PERMISSIONS.EMPLOYEES_MANAGE,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.REPORTS_EXPORT,
  ],
  EMPLOYEE: [
    PERMISSIONS.PRODUCTS_VIEW,
    PERMISSIONS.STOCK_VIEW,
    PERMISSIONS.SALES_VIEW,
    PERMISSIONS.SALES_CREATE,
    PERMISSIONS.SALES_EDIT,
    PERMISSIONS.DRAFTS_VIEW,
    PERMISSIONS.DRAFTS_CREATE,
    PERMISSIONS.DRAFTS_EDIT,
    PERMISSIONS.INVOICES_VIEW,
    PERMISSIONS.INVOICES_CREATE,
    PERMISSIONS.CUSTOMERS_VIEW,
    PERMISSIONS.CUSTOMERS_CREATE,
    PERMISSIONS.CUSTOMERS_EDIT,
  ],
  CASHIER: [
    PERMISSIONS.PRODUCTS_VIEW,
    PERMISSIONS.STOCK_VIEW,
    PERMISSIONS.SALES_VIEW,
    PERMISSIONS.SALES_CREATE,
    PERMISSIONS.DRAFTS_VIEW,
    PERMISSIONS.DRAFTS_CREATE,
    PERMISSIONS.DRAFTS_EDIT,
    PERMISSIONS.INVOICES_VIEW,
    PERMISSIONS.INVOICES_CREATE,
    PERMISSIONS.CUSTOMERS_VIEW,
    PERMISSIONS.CUSTOMERS_CREATE,
  ],
  VIEWER: [
    PERMISSIONS.PRODUCTS_VIEW,
    PERMISSIONS.STOCK_VIEW,
    PERMISSIONS.SALES_VIEW,
    PERMISSIONS.INVOICES_VIEW,
    PERMISSIONS.CUSTOMERS_VIEW,
    PERMISSIONS.REPORTS_VIEW,
  ],
};

/**
 * Check if user has permission
 */
export function hasPermission(
  userPermissions: string[],
  requiredPermission: Permission
): boolean {
  // Wildcard means all permissions
  if (userPermissions.includes('*')) {
    return true;
  }
  return userPermissions.includes(requiredPermission);
}

/**
 * Require permission (throws if not authorized)
 */
export function requirePermission(
  userPermissions: string[],
  requiredPermission: Permission
): void {
  if (!hasPermission(userPermissions, requiredPermission)) {
    throw new Error(`Permission denied: ${requiredPermission}`);
  }
}

/**
 * Get default permissions for role
 */
export function getDefaultPermissionsForRole(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}

