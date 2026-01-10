import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = await params

    // Get all balance history
    const balanceHistory = await prisma.customerBalance.findMany({
      where: {
        customerId: id,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 200,
    })

    // Get all invoice IDs from balance history
    const invoiceIds = balanceHistory
      .map(item => item.invoiceId)
      .filter((id): id is string => id !== null)

    // Fetch invoices separately if there are any
    const invoices = invoiceIds.length > 0
      ? await prisma.invoice.findMany({
          where: {
            id: { in: invoiceIds },
          },
          select: {
            id: true,
            invoiceNumber: true,
            total: true,
            amountPaid: true,
            amountDue: true,
            status: true,
            invoiceDate: true,
          },
        })
      : []

    // Create a map for quick lookup
    const invoiceMap = new Map(invoices.map(inv => [inv.id, inv]))

    // Transform to balance statement format
    const history = balanceHistory.map(item => {
      const invoice = item.invoiceId ? invoiceMap.get(item.invoiceId) || null : null
      let type: 'payment' | 'invoice' | 'sale' | 'adjustment' = 'adjustment'
      const amountNum = Number(item.amount)
      if (amountNum < 0) {
        type = 'payment'
      } else if (item.invoiceId) {
        type = 'invoice'
      } else if (item.saleId) {
        type = 'sale'
      }

      return {
        id: item.id,
        date: item.createdAt.toISOString(),
        amount: Number(item.amount),
        balance: Number(item.balance),
        description: item.description,
        type,
        reference: item.invoiceId || item.saleId || null,
        invoice: invoice ? {
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          total: Number(invoice.total),
          amountPaid: Number(invoice.amountPaid),
          amountDue: Number(invoice.amountDue),
          status: invoice.status,
          invoiceDate: invoice.invoiceDate.toISOString(),
        } : null,
      }
    })

    return NextResponse.json({ history })
  } catch (error) {
    console.error('Error fetching balance history:', error)
    return NextResponse.json(
      { error: 'Failed to fetch balance history' },
      { status: 500 }
    )
  }
}

