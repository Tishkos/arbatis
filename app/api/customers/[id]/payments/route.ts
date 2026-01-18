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

    // Get payments from CustomerBalance where amount is negative (credit/payment)
    const balanceHistory = await prisma.customerBalance.findMany({
      where: {
        customerId: id,
        amount: { lt: 0 }, // Negative amount = payment
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
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
            createdBy: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        })
      : []

    // Create a map for quick lookup
    const invoiceMap = new Map(invoices.map(inv => [inv.id, inv]))

    // Transform to payment format
    const payments = balanceHistory.map(item => {
      const invoice = item.invoiceId ? invoiceMap.get(item.invoiceId) || null : null
      // Try to extract USD amount from description
      let amountUsd = 0
      const usdMatch = item.description?.match(/USD:\s*([\d.]+)/i)
      if (usdMatch) {
        amountUsd = parseFloat(usdMatch[1])
      }
      
      // Try to extract IQD amount from description
      let amountIqd = Math.abs(Number(item.amount))
      const iqdMatch = item.description?.match(/IQD:\s*([\d.]+)/i)
      if (iqdMatch) {
        amountIqd = parseFloat(iqdMatch[1])
      }

      return {
        id: item.id,
        date: item.createdAt.toISOString(),
        amountIqd: amountIqd,
        amountUsd: amountUsd,
        description: item.description,
        paymentMethod: item.description?.includes('CASH') ? 'CASH' : 
                       item.description?.includes('BANK') ? 'BANK_TRANSFER' : 
                       item.description?.includes('CHECK') ? 'CHECK' : 'OTHER',
        invoiceNumber: invoice?.invoiceNumber || null,
        createdBy: invoice?.createdBy || null,
      }
    })

    return NextResponse.json({ payments })
  } catch (error) {
    console.error('Error fetching payments:', error)
    return NextResponse.json(
      { error: 'Failed to fetch payments' },
      { status: 500 }
    )
  }
}

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

    const { id } = await params
    const body = await request.json()
    const { amountIqd, amountUsd, paymentMethod, description } = body

    // Get current user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Get current customer
    const customer = await prisma.customer.findUnique({
      where: { id },
    })

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }

    // Calculate total payment amount (convert all to IQD for balance calculation)
    // For simplicity, we'll use IQD as base currency
    const totalPaymentIqd = parseFloat(amountIqd || '0')
    const totalPaymentUsd = parseFloat(amountUsd || '0')
    
    // CRITICAL: Validate that payment does not exceed customer debt
    const currentDebtIqd = Number(customer.debtIqd || 0)
    const currentDebtUsd = Number(customer.debtUsd || 0)
    const currentBalanceIqd = Number(customer.currentBalance || 0)
    
    // Validate IQD payment doesn't exceed debt
    if (totalPaymentIqd > 0 && totalPaymentIqd > currentBalanceIqd) {
      return NextResponse.json(
        { error: `Payment amount (${totalPaymentIqd.toLocaleString('en-US')} د.ع) exceeds customer balance (${currentBalanceIqd.toLocaleString('en-US')} د.ع). Cannot pay more than debt.` },
        { status: 400 }
      )
    }
    
    // Validate USD payment doesn't exceed debt
    if (totalPaymentUsd > 0 && totalPaymentUsd > currentDebtUsd) {
      return NextResponse.json(
        { error: `Payment amount ($${totalPaymentUsd.toLocaleString('en-US')}) exceeds customer debt ($${currentDebtUsd.toLocaleString('en-US')}). Cannot pay more than debt.` },
        { status: 400 }
      )
    }
    
    // Update customer debts (payment reduces debt)
    const newDebtIqd = Math.max(0, currentDebtIqd - totalPaymentIqd)
    const newDebtUsd = Math.max(0, currentDebtUsd - totalPaymentUsd)
    
    // Calculate new balance (reduce debt = negative amount in balance)
    const paymentAmount = -totalPaymentIqd // Negative = credit/payment
    const newBalance = Number(customer.currentBalance) + paymentAmount

    let invoiceId: string | null = null

    // Always create invoice for payments
    if (totalPaymentIqd > 0 || totalPaymentUsd > 0) {
      // Determine currency: if USD payment exists, use USD, otherwise IQD
      const invoiceCurrency = totalPaymentUsd > 0 ? 'USD' : 'IQD'
      const invoiceTotal = invoiceCurrency === 'USD' ? totalPaymentUsd : totalPaymentIqd
      
      // Generate invoice number in format: customerName-YYYY-MM-DD-RANDOMCODE
      const now = new Date()
      const dateStr = now.toISOString().split('T')[0] // YYYY-MM-DD format
      const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase()
      const customerNamePart = customer.name.split(' ')[0] || customer.name || 'CUST'
      const invoiceNumber = `${customerNamePart}-${dateStr}-${randomCode}`

      // Create invoice in transaction
      const result = await prisma.$transaction(async (tx) => {
        // Create a sale record for the payment
        const sale = await tx.sale.create({
          data: {
            type: 'JUMLA', // Wholesale payment
            customerId: id,
            status: 'COMPLETED',
            subtotal: invoiceTotal,
            taxAmount: 0,
            discount: 0,
            total: invoiceTotal,
            paymentMethod: paymentMethod || 'CASH',
            amountPaid: invoiceTotal,
            amountDue: 0, // Payment invoice is always fully paid
            createdById: user.id,
            items: {
              create: [{
                productId: null,
                quantity: 1,
                unitPrice: invoiceTotal,
                discount: 0,
                taxRate: 0,
                lineTotal: invoiceTotal,
                notes: `PAYMENT: ${description || `Payment received - ${paymentMethod || 'CASH'}`}`,
                order: 0,
              }],
            },
          },
        })

        // Create invoice
        const invoice = await tx.invoice.create({
          data: {
            saleId: sale.id,
            customerId: id,
            invoiceNumber: invoiceNumber,
            status: 'PAID',
            subtotal: invoiceTotal,
            taxAmount: 0,
            discount: 0,
            total: invoiceTotal,
            amountPaid: invoiceTotal,
            amountDue: 0,
            dueDate: new Date(),
            invoiceDate: new Date(),
            paidAt: new Date(),
            notes: description || `Payment invoice - ${paymentMethod || 'CASH'}`,
            createdById: user.id,
          },
        })

        return invoice.id
      })

      invoiceId = result
    }

    // Create balance record and link to invoice if created
    await prisma.customerBalance.create({
      data: {
        customerId: id,
        amount: paymentAmount,
        balance: newBalance,
        description: description || `Payment: ${paymentMethod || 'CASH'} - IQD: ${amountIqd || 0}, USD: ${amountUsd || 0}`,
        invoiceId: invoiceId || null,
      },
    })

    // Update customer
    await prisma.customer.update({
      where: { id },
      data: {
        debtIqd: newDebtIqd,
        debtUsd: newDebtUsd,
        currentBalance: newBalance,
        lastPaymentDate: new Date(),
        daysOverdue: 0, // Reset overdue days on payment
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Payment processed successfully',
      invoiceId: invoiceId,
    })
  } catch (error) {
    console.error('Error processing payment:', error)
    return NextResponse.json(
      { error: 'Failed to process payment' },
      { status: 500 }
    )
  }
}

