import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { DraftService } from '@/modules/drafts/services'

const draftService = new DraftService()

export async function POST(
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

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const { id } = await params
    const body = await request.json()
    const { paymentMethod, amountPaid, invoiceNumber, currency, notes } = body

    // Finalize the draft (converts to sale + invoice)
    const result = await draftService.finalize(
      {
        draftId: id,
        paymentMethod: paymentMethod || 'CASH',
        amountPaid: amountPaid || 0,
        invoiceNumber: invoiceNumber || undefined,
        currency: currency || 'IQD',
        notes: notes || undefined,
      },
      user.id
    )

    // Fetch invoice to get invoice number
    const invoice = await prisma.invoice.findUnique({
      where: { id: result.invoiceId },
      select: { invoiceNumber: true },
    })

    return NextResponse.json({
      success: true,
      saleId: result.saleId,
      invoiceId: result.invoiceId,
      invoiceNumber: invoice?.invoiceNumber || invoiceNumber || 'N/A',
    })
  } catch (error) {
    console.error('Error finalizing draft:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to finalize draft'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

