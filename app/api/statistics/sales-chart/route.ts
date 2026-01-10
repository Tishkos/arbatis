import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const timeRange = searchParams.get('timeRange') || '90d' // 90d, 30d, 7d
    const currency = searchParams.get('currency') || 'all' // all, USD, IQD

    // Calculate date range
    const now = new Date()
    let startDate = new Date()
    
    if (timeRange === '7d') {
      startDate.setDate(now.getDate() - 7)
    } else if (timeRange === '30d') {
      startDate.setDate(now.getDate() - 30)
    } else {
      startDate.setDate(now.getDate() - 90)
    }

    // Build where clause
    const whereClause: any = {
      invoiceDate: {
        gte: startDate.toISOString(),
        lte: now.toISOString(),
      },
      status: {
        in: ['PAID', 'PARTIALLY_PAID'],
      },
    }

    // Fetch invoices with items to determine currency
    const invoices = await prisma.invoice.findMany({
      where: whereClause,
      select: {
        invoiceDate: true,
        total: true,
        items: {
          select: {
            notes: true,
            product: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        invoiceDate: 'asc',
      },
    })

    // Fetch customer payments (from CustomerBalance where amount < 0)
    const payments = await prisma.customerBalance.findMany({
      where: {
        createdAt: {
          gte: startDate.toISOString(),
          lte: now.toISOString(),
        },
        amount: {
          lt: 0, // Negative amount = payment
        },
      },
      select: {
        createdAt: true,
        amount: true,
        description: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    })

    // Group by date
    const dataMap = new Map<string, { iqd: number; usd: number }>()
    
    // Process invoices
    invoices.forEach((invoice) => {
      // Determine currency based on items (motorcycle = USD, product = IQD)
      const isMotorcycle = invoice.items?.some((item) => {
        const productName = item.product?.name?.toLowerCase() || ''
        const notes = item.notes?.toLowerCase() || ''
        return productName.includes('motorcycle') || notes.startsWith('motorcycle:')
      }) || false
      
      const invoiceCurrency = isMotorcycle ? 'USD' : 'IQD'
      
      // Filter by currency if not 'all'
      if (currency !== 'all' && invoiceCurrency !== currency) {
        return
      }
      
      const dateStr = new Date(invoice.invoiceDate).toISOString().split('T')[0]
      const existing = dataMap.get(dateStr) || { iqd: 0, usd: 0 }
      
      if (invoiceCurrency === 'IQD') {
        existing.iqd += Number(invoice.total || 0)
      } else {
        existing.usd += Number(invoice.total || 0)
      }
      
      dataMap.set(dateStr, existing)
    })

    // Process customer payments
    payments.forEach((payment) => {
      const paymentDate = new Date(payment.createdAt).toISOString().split('T')[0]
      const existing = dataMap.get(paymentDate) || { iqd: 0, usd: 0 }
      
      // Try to extract USD amount from description
      let amountUsd = 0
      let amountIqd = Math.abs(Number(payment.amount))
      
      if (payment.description) {
        const usdMatch = payment.description.match(/USD:\s*([\d.]+)/i)
        if (usdMatch) {
          amountUsd = parseFloat(usdMatch[1])
          // If USD found, check if IQD is also specified, otherwise calculate from amount
          const iqdMatch = payment.description.match(/IQD:\s*([\d.]+)/i)
          if (iqdMatch) {
            amountIqd = parseFloat(iqdMatch[1])
          } else {
            // If only USD in description, assume payment is USD-only
            amountIqd = 0
          }
        } else {
          // No USD in description, assume IQD payment
          amountIqd = Math.abs(Number(payment.amount))
        }
      }
      
      // Filter by currency if not 'all'
      if (currency !== 'all') {
        if (currency === 'USD' && amountUsd === 0) return
        if (currency === 'IQD' && amountIqd === 0) return
      }
      
      existing.iqd += Math.round(amountIqd)
      existing.usd += Math.round(amountUsd)
      
      dataMap.set(paymentDate, existing)
    })

    // Convert to array format
    const result = Array.from(dataMap.entries())
      .map(([date, values]) => ({
        date,
        iqd: Math.round(values.iqd),
        usd: Math.round(values.usd),
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return NextResponse.json({ data: result })
  } catch (error) {
    console.error("Error fetching sales chart data:", error)
    return NextResponse.json(
      { error: "Failed to fetch sales chart data" },
      { status: 500 }
    )
  }
}

