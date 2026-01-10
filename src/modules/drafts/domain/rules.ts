/**
 * Draft Business Rules
 * Pure functions for draft validation and business logic
 */

import { SaleType, DraftStatus } from '@prisma/client';
import type { DraftDomain, DraftItemDomain } from './types';

/**
 * Validate that a draft can be finalized
 */
export function canFinalizeDraft(draft: DraftDomain): {
  canFinalize: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Must have at least one item
  if (!draft.items || draft.items.length === 0) {
    errors.push('Draft must have at least one item');
  }

  // Jumla sales require a customer
  if (draft.type === 'JUMLA' && !draft.customerId) {
    errors.push('Jumla (wholesale) sales require a customer');
  }

  // Cannot finalize if already finalized or cancelled
  if (draft.status === 'FINALIZED') {
    errors.push('Draft is already finalized');
  }

  if (draft.status === 'CANCELLED') {
    errors.push('Cancelled drafts cannot be finalized');
  }

  // All items must have valid quantities
  for (const item of draft.items || []) {
    if (item.quantity <= 0) {
      errors.push(`Item ${item.id} has invalid quantity`);
    }
    if (item.unitPrice < 0) {
      errors.push(`Item ${item.id} has invalid unit price`);
    }
  }

  // Total must be positive
  if (draft.total <= 0) {
    errors.push('Draft total must be greater than zero');
  }

  return {
    canFinalize: errors.length === 0,
    errors,
  };
}

/**
 * Calculate line item total
 */
export function calculateLineTotal(
  quantity: number,
  unitPrice: number,
  discount: number = 0,
  taxRate: number = 0
): number {
  const subtotal = quantity * unitPrice;
  const discountAmount = subtotal * (discount / 100);
  const afterDiscount = subtotal - discountAmount;
  const taxAmount = afterDiscount * (taxRate / 100);
  return afterDiscount + taxAmount;
}

/**
 * Calculate draft totals from items
 */
export function calculateDraftTotals(
  items: DraftItemDomain[],
  invoiceDiscount: number = 0
): {
  subtotal: number;
  taxAmount: number;
  discount: number;
  total: number;
} {
  const subtotal = items.reduce((sum, item) => {
    const itemSubtotal = item.quantity * item.unitPrice;
    const itemDiscount = itemSubtotal * (item.discount / 100);
    return sum + itemSubtotal - itemDiscount;
  }, 0);

  const invoiceDiscountAmount = subtotal * (invoiceDiscount / 100);
  const afterDiscount = subtotal - invoiceDiscountAmount;

  const taxAmount = items.reduce((sum, item) => {
    const itemSubtotal = item.quantity * item.unitPrice;
    const itemDiscount = itemSubtotal * (item.discount / 100);
    const itemAfterDiscount = itemSubtotal - itemDiscount;
    return sum + itemAfterDiscount * (item.taxRate / 100);
  }, 0);

  const total = afterDiscount + taxAmount;

  return {
    subtotal,
    taxAmount,
    discount: invoiceDiscountAmount,
    total,
  };
}

/**
 * Validate draft status transition
 */
export function canTransitionStatus(
  currentStatus: DraftStatus,
  newStatus: DraftStatus
): boolean {
  const allowedTransitions: Record<DraftStatus, DraftStatus[]> = {
    CREATED: ['AUTOSAVING', 'READY', 'CANCELLED'],
    AUTOSAVING: ['READY', 'CREATED', 'CANCELLED'],
    READY: ['FINALIZING', 'CANCELLED'],
    FINALIZING: ['FINALIZED'],
    FINALIZED: [], // Final state
    CANCELLED: [], // Final state
  };

  return allowedTransitions[currentStatus]?.includes(newStatus) ?? false;
}

/**
 * Check if draft can be edited
 */
export function canEditDraft(draft: DraftDomain): boolean {
  return (
    draft.status === 'CREATED' ||
    draft.status === 'AUTOSAVING' ||
    draft.status === 'READY'
  );
}

