import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { InvoiceDetail } from '@/components/invoice-detail'

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  const { locale, id } = await params

  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    notFound()
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          sku: true,
          email: true,
          phone: true,
          debtIqd: true,
          debtUsd: true,
          currentBalance: true,
        },
      },
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      sale: {
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                  stockQuantity: true,
                },
              },
            },
          },
        },
      },
      items: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              stockQuantity: true,
            },
          },
        },
        orderBy: {
          order: 'asc',
        },
      },
    },
  })

  if (!invoice) {
    notFound()
  }

  // Convert Decimal to number
  const invoiceWithNumbers = {
    ...invoice,
    subtotal: Number(invoice.subtotal),
    taxAmount: Number(invoice.taxAmount),
    discount: Number(invoice.discount),
    total: Number(invoice.total),
    amountPaid: Number(invoice.amountPaid),
    amountDue: Number(invoice.amountDue),
    customer: invoice.customer ? {
      ...invoice.customer,
      debtIqd: Number(invoice.customer.debtIqd),
      debtUsd: Number(invoice.customer.debtUsd),
      currentBalance: Number(invoice.customer.currentBalance),
    } : null,
    invoiceDate: invoice.invoiceDate.toISOString(),
    dueDate: invoice.dueDate?.toISOString() || null,
    paidAt: invoice.paidAt?.toISOString() || null,
    createdAt: invoice.createdAt.toISOString(),
    updatedAt: invoice.updatedAt.toISOString(),
    items: invoice.items.map((item) => ({
      id: item.id,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      discount: Number(item.discount),
      taxRate: Number(item.taxRate),
      lineTotal: Number(item.lineTotal),
      notes: item.notes,
      order: item.order,
      product: item.product ? {
        id: item.product.id,
        name: item.product.name,
        sku: item.product.sku,
        stockQuantity: item.product.stockQuantity,
      } : null,
    })),
    sale: invoice.sale ? {
      id: invoice.sale.id,
      type: invoice.sale.type,
      status: invoice.sale.status,
      paymentMethod: invoice.sale.paymentMethod,
      items: invoice.sale.items.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        discount: Number(item.discount),
        taxRate: Number(item.taxRate),
        lineTotal: Number(item.lineTotal),
        notes: item.notes,
        product: item.product ? {
          id: item.product.id,
          name: item.product.name,
          sku: item.product.sku,
          stockQuantity: item.product.stockQuantity,
        } : null,
      })),
    } : null,
  }

  return <InvoiceDetail invoice={invoiceWithNumbers} locale={locale} />
}

