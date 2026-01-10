/**
 * Draft Service
 * Business logic for draft operations
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { canFinalizeDraft, calculateDraftTotals, canEditDraft } from './domain/rules';
import type {
  DraftDomain,
  CreateDraftInput,
  UpdateDraftInput,
  FinalizeDraftInput,
  DraftStatus,
} from './domain/types';
import { DraftRepository } from './repositories';

export class DraftService {
  private repository: DraftRepository;

  constructor() {
    this.repository = new DraftRepository();
  }

  /**
   * Create a new draft
   */
  async create(input: CreateDraftInput, userId: string): Promise<DraftDomain> {
    // Calculate totals
    const itemsWithTotals = input.items.map((item, index) => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: item.discount || 0,
      taxRate: item.taxRate || 0,
      lineTotal: this.calculateLineTotal(
        item.quantity,
        item.unitPrice,
        item.discount || 0,
        item.taxRate || 0
      ),
      notes: item.notes,
      order: index,
    }));

    const totals = calculateDraftTotals(itemsWithTotals as any, input.discount || 0);

    // Create draft
    const draft = await this.repository.create({
      ...input,
      ...totals,
      items: itemsWithTotals.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount,
        taxRate: item.taxRate,
        lineTotal: item.lineTotal,
        notes: item.notes,
        order: item.order,
      })),
      createdById: userId,
    });

    logger.info('Draft created', userId, { draftId: draft.id });

    return draft;
  }

  /**
   * Update a draft (autosave)
   */
  async update(
    draftId: string,
    input: UpdateDraftInput,
    userId: string
  ): Promise<DraftDomain> {
    // Get existing draft
    const existing = await this.repository.findById(draftId);
    if (!existing) {
      throw new Error('Draft not found');
    }

    // Check if can be edited
    if (!canEditDraft(existing)) {
      throw new Error('Draft cannot be edited in its current state');
    }

    // Update items if provided
    let items = existing.items;
    if (input.items) {
      items = input.items.map((item, index) => ({
        id: '', // Will be set by repository
        draftId: draftId,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount || 0,
        taxRate: item.taxRate || 0,
        lineTotal: this.calculateLineTotal(
          item.quantity,
          item.unitPrice,
          item.discount || 0,
          item.taxRate || 0
        ),
        notes: item.notes,
        order: index,
      }));
    }

    // Recalculate totals
    const totals = calculateDraftTotals(items as any, input.discount || existing.discount || 0);

    // Update draft
    const draft = await this.repository.update(draftId, {
      ...input,
      ...totals,
      items: items.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount,
        taxRate: item.taxRate,
        lineTotal: item.lineTotal,
        notes: item.notes,
        order: item.order,
      })),
    });

    logger.debug('Draft updated (autosave)', userId, { draftId });

    return draft;
  }

  /**
   * Finalize a draft (convert to sale + invoice)
   */
  async finalize(input: FinalizeDraftInput, userId: string): Promise<{
    saleId: string;
    invoiceId: string;
  }> {
    // Get draft
    const draft = await this.repository.findById(input.draftId);
    if (!draft) {
      throw new Error('Draft not found');
    }

    // Validate draft can be finalized
    const validation = canFinalizeDraft(draft);
    if (!validation.canFinalize) {
      throw new Error(`Cannot finalize draft: ${validation.errors.join(', ')}`);
    }

    // Lock draft
    await this.repository.updateStatus(input.draftId, 'FINALIZING');

    try {
      // Import here to avoid circular dependencies
      const { SaleService } = await import('../sales/services');
      const saleService = new SaleService();

      // Create sale from draft with invoice number and currency
      const sale = await saleService.createFromDraft(draft, input, userId);

      // Mark draft as finalized
      await this.repository.finalize(input.draftId, sale.id, sale.invoiceId!);

      logger.audit('Draft finalized', 'Draft', input.draftId, userId, {
        saleId: sale.id,
        invoiceId: sale.invoiceId,
      });

      return {
        saleId: sale.id,
        invoiceId: sale.invoiceId!,
      };
    } catch (error) {
      // Unlock draft on error
      await this.repository.updateStatus(input.draftId, 'READY');
      throw error;
    }
  }

  /**
   * Calculate line item total
   */
  private calculateLineTotal(
    quantity: number,
    unitPrice: number,
    discount: number,
    taxRate: number
  ): number {
    const subtotal = quantity * unitPrice;
    const discountAmount = subtotal * (discount / 100);
    const afterDiscount = subtotal - discountAmount;
    const taxAmount = afterDiscount * (taxRate / 100);
    return afterDiscount + taxAmount;
  }

  /**
   * Get user's drafts
   */
  async getUserDrafts(userId: string, status?: string): Promise<DraftDomain[]> {
    return this.repository.findByUserId(userId, status);
  }

  /**
   * Get draft by ID
   */
  async getById(draftId: string): Promise<DraftDomain | null> {
    return this.repository.findById(draftId);
  }

  /**
   * Update draft status
   */
  async updateStatus(draftId: string, status: DraftStatus): Promise<DraftDomain> {
    await this.repository.updateStatus(draftId, status);
    const draft = await this.repository.findById(draftId);
    if (!draft) {
      throw new Error('Draft not found after status update');
    }
    return draft;
  }

  /**
   * Cancel a draft
   */
  async cancel(draftId: string, userId: string): Promise<void> {
    const draft = await this.repository.findById(draftId);
    if (!draft) {
      throw new Error('Draft not found');
    }

    if (draft.status === 'FINALIZED') {
      throw new Error('Cannot cancel a finalized draft');
    }

    await this.repository.cancel(draftId);

    logger.audit('Draft cancelled', 'Draft', draftId, userId);
  }
}

