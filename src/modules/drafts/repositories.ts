/**
 * Draft Repository
 * Data access layer for drafts
 */

import { prisma } from '@/lib/db';
import { DraftStatus } from '@prisma/client';
import type { DraftDomain, DraftItemDomain } from './domain/types';

export class DraftRepository {
  /**
   * Create a new draft
   */
  async create(data: {
    type: string;
    customerId?: string;
    subtotal: number;
    taxAmount: number;
    discount: number;
    total: number;
    paymentMethod?: string;
    amountPaid?: number;
    notes?: string;
    items: Array<{
      productId?: string;
      quantity: number;
      unitPrice: number;
      discount: number;
      taxRate: number;
      lineTotal: number;
      notes?: string;
      order: number;
    }>;
    createdById: string;
  }): Promise<DraftDomain> {
    const draft = await prisma.draft.create({
      data: {
        type: data.type as any,
        customerId: data.customerId,
        subtotal: data.subtotal,
        taxAmount: data.taxAmount,
        discount: data.discount,
        total: data.total,
        paymentMethod: data.paymentMethod,
        amountPaid: data.amountPaid,
        notes: data.notes,
        status: 'CREATED',
        createdById: data.createdById,
        items: {
          create: data.items.map((item) => ({
            productId: item.productId,
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
        items: {
          include: {
            product: true,
          },
          orderBy: {
            order: 'asc',
          },
        },
        customer: true,
      },
    });

    return this.mapToDomain(draft);
  }

  /**
   * Find draft by ID
   */
  async findById(draftId: string): Promise<DraftDomain | null> {
    const draft = await prisma.draft.findUnique({
      where: { id: draftId },
      include: {
        items: {
          include: {
            product: true,
          },
          orderBy: {
            order: 'asc',
          },
        },
        customer: true,
      },
    });

    return draft ? this.mapToDomain(draft) : null;
  }

  /**
   * Find drafts by user ID
   */
  async findByUserId(
    userId: string,
    status?: string
  ): Promise<DraftDomain[]> {
    const where: any = {
      createdById: userId,
    };

    if (status) {
      where.status = status;
    }

    const drafts = await prisma.draft.findMany({
      where,
      include: {
        items: {
          include: {
            product: true,
          },
          orderBy: {
            order: 'asc',
          },
        },
        customer: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return drafts.map(this.mapToDomain);
  }

  /**
   * Update draft
   */
  async update(
    draftId: string,
    data: {
      customerId?: string;
      subtotal?: number;
      taxAmount?: number;
      discount?: number;
      total?: number;
      paymentMethod?: string;
      amountPaid?: number;
      notes?: string;
      items?: Array<{
        productId?: string;
        quantity: number;
        unitPrice: number;
        discount: number;
        taxRate: number;
        lineTotal: number;
        notes?: string;
        order: number;
      }>;
    }
  ): Promise<DraftDomain> {
    // If items are provided, replace all items
    if (data.items) {
      // Delete existing items
      await prisma.draftItem.deleteMany({
        where: { draftId },
      });

      // Create new items
      await prisma.draftItem.createMany({
        data: data.items.map((item) => ({
          draftId,
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
    }

    // Update draft
    const { items, ...updateData } = data;
    const draft = await prisma.draft.update({
      where: { id: draftId },
      data: {
        ...updateData,
        status: 'AUTOSAVING',
      },
      include: {
        items: {
          include: {
            product: true,
          },
          orderBy: {
            order: 'asc',
          },
        },
        customer: true,
      },
    });

    return this.mapToDomain(draft);
  }

  /**
   * Update draft status
   */
  async updateStatus(draftId: string, status: DraftStatus): Promise<void> {
    await prisma.draft.update({
      where: { id: draftId },
      data: { status },
    });
  }

  /**
   * Mark draft as finalized
   */
  async finalize(
    draftId: string,
    saleId: string,
    invoiceId: string
  ): Promise<void> {
    await prisma.draft.update({
      where: { id: draftId },
      data: {
        status: 'FINALIZED',
        saleId,
        invoiceId,
        finalizedAt: new Date(),
      },
    });
  }

  /**
   * Cancel draft
   */
  async cancel(draftId: string): Promise<void> {
    await prisma.draft.update({
      where: { id: draftId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
      },
    });
  }

  /**
   * Map Prisma model to domain model
   */
  private mapToDomain(draft: any): DraftDomain {
    return {
      id: draft.id,
      type: draft.type,
      status: draft.status,
      customerId: draft.customerId ?? undefined,
      subtotal: Number(draft.subtotal),
      taxAmount: Number(draft.taxAmount),
      discount: Number(draft.discount),
      total: Number(draft.total),
      paymentMethod: draft.paymentMethod ?? undefined,
      amountPaid: draft.amountPaid ? Number(draft.amountPaid) : undefined,
      notes: draft.notes ?? undefined,
      items: draft.items.map((item: any): DraftItemDomain => ({
        id: item.id,
        draftId: item.draftId,
        productId: item.productId ?? undefined,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        discount: Number(item.discount),
        taxRate: Number(item.taxRate),
        lineTotal: Number(item.lineTotal),
        notes: item.notes ?? undefined,
        order: item.order,
      })),
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt,
      createdById: draft.createdById,
    };
  }
}

