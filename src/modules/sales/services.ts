/**
 * Sale Service
 * Business logic for sales operations
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import type { DraftDomain } from '../drafts/domain/types';
import type { FinalizeDraftInput } from '../drafts/domain/types';

export interface SaleResult {
  id: string;
  invoiceId: string | null;
}

export class SaleService {
  /**
   * Create a sale and invoice from a finalized draft
   */
  async createFromDraft(
    draft: DraftDomain,
    input: FinalizeDraftInput,
    userId: string
  ): Promise<SaleResult> {
    // Validate draft
    if (draft.type === 'JUMLA' && !draft.customerId) {
      throw new Error('Wholesale sales require a customer');
    }

    if (!draft.items || draft.items.length === 0) {
      throw new Error('Draft must have at least one item');
    }

    // Auto-determine currency based on items:
    // - If any item has MOTORCYCLE: in notes, it's a motorcycle invoice = USD
    // - Otherwise, it's a product invoice = IQD
    const hasMotorcycle = draft.items.some(item => item.notes?.startsWith('MOTORCYCLE:'));
    const autoCurrency = hasMotorcycle ? 'USD' : 'IQD';
    const currency = input.currency || autoCurrency;
    
    // Calculate payment status
    const amountPaid = input.amountPaid || 0;
    const total = Number(draft.total);
    const amountDue = total - amountPaid;
    
    let invoiceStatus: 'PAID' | 'PARTIALLY_PAID';
    if (Math.abs(amountPaid - total) < 0.01 || amountPaid >= total) {
      // Fully paid (with small tolerance for floating point)
      invoiceStatus = 'PAID';
    } else {
      // Partially paid or not paid (both are PARTIALLY_PAID)
      invoiceStatus = 'PARTIALLY_PAID';
    }

    // Create sale and invoice in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Generate invoice number (series) inside transaction
      let invoiceNumber = input.invoiceNumber;
      
      if (!invoiceNumber && draft.customerId) {
        // Fetch customer to get name for series generation
        const customer = await tx.customer.findUnique({
          where: { id: draft.customerId },
          select: { name: true },
        });
        
        if (customer) {
          // Generate series: customerName-YYYY-MM-DD-RANDOMCODE
          const now = new Date();
          const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
          const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
          invoiceNumber = `${customer.name}-${dateStr}-${randomCode}`;
        }
      }
      
      // Fallback if still no invoice number (for retail without customer)
      if (!invoiceNumber) {
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        invoiceNumber = `INVOICE-${dateStr}-${randomCode}`;
      }
      // Create Sale
      const sale = await tx.sale.create({
        data: {
          type: draft.type,
          customerId: draft.customerId || null,
          status: 'COMPLETED',
          subtotal: draft.subtotal,
          taxAmount: draft.taxAmount,
          discount: draft.discount,
          total: draft.total,
          paymentMethod: input.paymentMethod || 'CASH',
          amountPaid: amountPaid,
          amountDue: amountDue,
          createdById: userId,
          items: {
            create: draft.items.map((item) => ({
              productId: item.productId || null,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: item.discount,
              taxRate: item.taxRate,
              lineTotal: item.lineTotal,
              notes: item.notes,
              order: item.order,
            })),
          },
        },
        include: {
          items: true,
        },
      });

      // Create Invoice with series as invoice number
      const invoice = await tx.invoice.create({
        data: {
          saleId: sale.id,
          customerId: draft.customerId || null,
          invoiceNumber: invoiceNumber, // Use series format: customerName-date-generatedCode
          status: invoiceStatus,
          subtotal: draft.subtotal,
          taxAmount: draft.taxAmount,
          discount: draft.discount,
          total: draft.total,
          amountPaid: amountPaid,
          amountDue: amountDue,
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
          invoiceDate: new Date(),
          paidAt: invoiceStatus === 'PAID' ? new Date() : null,
          notes: input.notes || draft.notes || null,
          createdById: userId,
        },
      });

      // Update customer debt and balance if customer exists
      // For wholesale (JUMLA): ALWAYS update debt based on amountDue (outstanding amount)
      // For retail (MUFRAD) with customer: Also update debt
      if (draft.customerId) {
        const customer = await tx.customer.findUnique({
          where: { id: draft.customerId },
        });

        if (customer) {
          // Calculate new debt and balance
          const currentDebtIqd = Number(customer.debtIqd || 0);
          const currentDebtUsd = Number(customer.debtUsd || 0);
          const currentBalance = Number(customer.currentBalance || 0);
          
          // Prepare update data
          const updateData: any = {};
          
          // CRITICAL: Always update debt based on amountDue (can be positive or negative)
          // amountDue = total - amountPaid
          // - If amountDue > 0: Customer still owes money (add to debt)
          // - If amountDue < 0: Customer overpaid (credit/overpayment, reduce debt)
          // - If amountDue = 0: Fully paid (no change to debt)
          // Products (IQD): Update debtIqd AND currentBalance
          // Motorcycles (USD): Update debtUsd (debtUsd serves as USD balance/debt)
          if (currency === 'IQD') {
            // Product invoice - update IQD debt and balance
            // Always update debt with amountDue (positive adds debt, negative reduces it)
            const newDebtIqd = currentDebtIqd + amountDue;
            const newBalance = currentBalance + amountDue; // Positive = owes, Negative = credit
            updateData.debtIqd = newDebtIqd;
            updateData.currentBalance = newBalance;
            
            // Update payment date if fully paid or overpaid
            if (invoiceStatus === 'PAID' || amountDue <= 0) {
              updateData.lastPaymentDate = new Date();
            } else {
              updateData.lastPaymentDate = customer.lastPaymentDate;
            }
          } else {
            // USD currency (Motorcycle invoice) - update USD debt
            // debtUsd serves as both debt and balance for USD transactions
            // Always update debt with amountDue (positive adds debt, negative reduces it)
            const newDebtUsd = currentDebtUsd + amountDue;
            updateData.debtUsd = newDebtUsd;
            
            // Update payment date if fully paid or overpaid
            if (invoiceStatus === 'PAID' || amountDue <= 0) {
              updateData.lastPaymentDate = new Date();
            } else {
              updateData.lastPaymentDate = customer.lastPaymentDate;
            }
          }
          
          // Only update if we have data to update
          if (Object.keys(updateData).length > 0) {
            await tx.customer.update({
              where: { id: draft.customerId },
              data: updateData,
            });
          }
        }
      }

      // Update stock quantities for products and motorcycles
      for (const item of draft.items) {
        // Check if it's a motorcycle (notes contain MOTORCYCLE:)
        const isMotorcycle = item.notes?.startsWith('MOTORCYCLE:');
        
        if (isMotorcycle && item.notes) {
          // Extract motorcycle ID from notes (format: MOTORCYCLE:motocycleId)
          const motorcycleId = item.notes.replace('MOTORCYCLE:', '');
          
          // Validate stock before updating
          const motorcycle = await tx.motorcycle.findUnique({
            where: { id: motorcycleId },
            select: { stockQuantity: true },
          });
          
          if (motorcycle) {
            // Validate stock quantity
            if (item.quantity > motorcycle.stockQuantity) {
              throw new Error(`Insufficient stock for motorcycle. Available: ${motorcycle.stockQuantity}, Requested: ${item.quantity}`);
            }
            
            // Update motorcycle stock quantity
            const oldStock = motorcycle.stockQuantity;
            const newStock = Math.max(0, motorcycle.stockQuantity - item.quantity);
            await tx.motorcycle.update({
              where: { id: motorcycleId },
              data: { stockQuantity: newStock },
            });
            
            // Log activity for motorcycle - stock reduced due to sale
            const motorcycleFull = await tx.motorcycle.findUnique({
              where: { id: motorcycleId },
              select: { brand: true, model: true },
            });
            
            if (motorcycleFull) {
              const motorcycleName = `${motorcycleFull.brand} ${motorcycleFull.model}`;
              const quantitySold = item.quantity;
              const unitPrice = Number(item.unitPrice) || 0;
              const totalPrice = quantitySold * unitPrice;
              
              // Create STOCK_REDUCED activity
              await tx.activity.create({
                data: {
                  entityType: 'MOTORCYCLE',
                  entityId: motorcycleId,
                  type: 'STOCK_REDUCED',
                  description: `Stock reduced for ${motorcycleName} due to sale (Qty: ${quantitySold}, Price: $${totalPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`,
                  changes: {
                    stockQuantity: {
                      old: oldStock,
                      new: newStock,
                    },
                  } as any,
                  invoiceId: invoice.id,
                  createdById: userId,
                },
              });
              
              // Create INVOICED activity
              await tx.activity.create({
                data: {
                  entityType: 'MOTORCYCLE',
                  entityId: motorcycleId,
                  type: 'INVOICED',
                  description: `${motorcycleName} was invoiced (Invoice: ${invoice.invoiceNumber}, Qty: ${quantitySold}, Price: $${totalPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`,
                  changes: {
                    invoiceNumber: invoice.invoiceNumber,
                    quantity: quantitySold,
                    unitPrice: unitPrice,
                    totalPrice: totalPrice,
                  } as any,
                  invoiceId: invoice.id,
                  createdById: userId,
                },
              });
            }
          }
        } else if (item.productId) {
          // Update product stock quantity
          const product = await tx.product.findUnique({
            where: { id: item.productId },
            select: { stockQuantity: true },
          });
          
          if (product) {
            // Validate stock quantity
            if (item.quantity > product.stockQuantity) {
              throw new Error(`Insufficient stock for product. Available: ${product.stockQuantity}, Requested: ${item.quantity}`);
            }
            
            const oldStock = product.stockQuantity;
            const newStock = Math.max(0, product.stockQuantity - item.quantity);
            await tx.product.update({
              where: { id: item.productId },
              data: { stockQuantity: newStock },
            });
            
            // Create stock movement record (audit trail) - only for products
            await tx.stockMovement.create({
              data: {
                productId: item.productId,
                type: 'SALE',
                quantity: -item.quantity, // Negative = decrease
                balanceAfter: newStock,
                saleId: sale.id,
                invoiceId: invoice.id,
                createdById: userId,
              },
            });
            
            // Log activity for product - stock reduced due to sale
            const productFull = await tx.product.findUnique({
              where: { id: item.productId },
              select: { name: true },
            });
            
            if (productFull) {
              const quantitySold = item.quantity;
              const unitPrice = Number(item.unitPrice) || 0;
              const totalPrice = quantitySold * unitPrice;
              
              // Create STOCK_REDUCED activity
              await tx.activity.create({
                data: {
                  entityType: 'PRODUCT',
                  entityId: item.productId,
                  type: 'STOCK_REDUCED',
                  description: `Stock reduced for ${productFull.name} due to sale (Qty: ${quantitySold}, Price: ع.د ${totalPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`,
                  changes: {
                    stockQuantity: {
                      old: oldStock,
                      new: newStock,
                    },
                  } as any,
                  invoiceId: invoice.id,
                  createdById: userId,
                },
              });
              
              // Create INVOICED activity
              await tx.activity.create({
                data: {
                  entityType: 'PRODUCT',
                  entityId: item.productId,
                  type: 'INVOICED',
                  description: `${productFull.name} was invoiced (Invoice: ${invoice.invoiceNumber}, Qty: ${quantitySold}, Price: ع.د ${totalPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`,
                  changes: {
                    invoiceNumber: invoice.invoiceNumber,
                    quantity: quantitySold,
                    unitPrice: unitPrice,
                    totalPrice: totalPrice,
                  } as any,
                  invoiceId: invoice.id,
                  createdById: userId,
                },
              });
            }
          }
        }
      }

      logger.audit('Sale created from draft', 'Sale', sale.id, userId, {
        draftId: draft.id,
        invoiceId: invoice.id,
        invoiceNumber: invoiceNumber,
      });

      return {
        id: sale.id,
        invoiceId: invoice.id,
      };
    });

    return result;
  }

  /**
   * Generate a unique invoice number (fallback if not provided)
   */
  private generateInvoiceNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `INV-${timestamp}-${random}`;
  }
}

