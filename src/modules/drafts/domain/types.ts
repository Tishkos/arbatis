/**
 * Draft Domain Types
 * Domain-level types for the Draft module
 */

import { DraftStatus, SaleType } from '@prisma/client';

export type { DraftStatus, SaleType };

export interface DraftDomain {
  id: string;
  type: SaleType;
  status: DraftStatus;
  customerId?: string;
  subtotal: number;
  taxAmount: number;
  discount: number;
  total: number;
  paymentMethod?: string;
  amountPaid?: number;
  notes?: string;
  items: DraftItemDomain[];
  createdAt: Date;
  updatedAt: Date;
  createdById: string;
}

export interface DraftItemDomain {
  id: string;
  draftId: string;
  productId?: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
  lineTotal: number;
  notes?: string;
  order: number;
}

/**
 * Draft creation input (DTO)
 */
export interface CreateDraftInput {
  type: SaleType;
  customerId?: string;
  items: CreateDraftItemInput[];
  discount?: number;
  paymentMethod?: string;
  notes?: string;
}

export interface CreateDraftItemInput {
  productId?: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  taxRate?: number;
  notes?: string;
}

/**
 * Draft update input (DTO)
 */
export interface UpdateDraftInput {
  customerId?: string;
  items?: CreateDraftItemInput[];
  discount?: number;
  paymentMethod?: string;
  amountPaid?: number;
  notes?: string;
}

/**
 * Draft finalization input
 */
export interface FinalizeDraftInput {
  draftId: string;
  paymentMethod: string;
  amountPaid: number;
  invoiceNumber?: string; // Series format: customerName-date-generatedCode
  currency?: 'IQD' | 'USD'; // Invoice currency
  notes?: string;
}

