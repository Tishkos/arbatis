import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get total revenue (IQD + USD) - need to determine currency from items
    const paidInvoices = await prisma.invoice.findMany({
      where: {
        status: { in: ['PAID', 'PARTIALLY_PAID'] },
      },
      select: {
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
    })

    let totalRevenueIqd = 0
    let totalRevenueUsd = 0

    paidInvoices.forEach((invoice) => {
      // Determine currency based on items (motorcycle = USD, product = IQD)
      const isMotorcycle = invoice.items?.some((item) => {
        const productName = item.product?.name?.toLowerCase() || ''
        const notes = item.notes?.toLowerCase() || ''
        return productName.includes('motorcycle') || notes.startsWith('motorcycle:')
      }) || false
      
      const invoiceTotal = Number(invoice.total || 0)
      if (isMotorcycle) {
        totalRevenueUsd += invoiceTotal
      } else {
        totalRevenueIqd += invoiceTotal
      }
    })

    // Get new customers count (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    const newCustomers = await prisma.customer.count({
      where: {
        createdAt: {
          gte: thirtyDaysAgo,
        },
      },
    })

    // Get total customers
    const totalCustomers = await prisma.customer.count()

    // Get active accounts (customers with at least one invoice)
    const activeAccounts = await prisma.customer.count({
      where: {
        invoices: {
          some: {},
        },
      },
    })

    // Calculate growth rate (compare last 30 days to previous 30 days)
    const sixtyDaysAgo = new Date()
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)
    
    const previousPeriodCustomers = await prisma.customer.count({
      where: {
        createdAt: {
          gte: sixtyDaysAgo,
          lt: thirtyDaysAgo,
        },
      },
    })

    const growthRate = previousPeriodCustomers > 0
      ? ((newCustomers - previousPeriodCustomers) / previousPeriodCustomers) * 100
      : newCustomers > 0 ? 100 : 0

    // Get total products, motorcycles, and invoices
    const [totalProducts, totalMotorcycles, totalInvoices] = await Promise.all([
      prisma.product.count(),
      prisma.motorcycle.count(),
      prisma.invoice.count({
        where: {
          status: {
            not: 'CANCELLED'
          }
        }
      }),
    ])

    return NextResponse.json({
      totalRevenueIqd: totalRevenueIqd,
      totalRevenueUsd: totalRevenueUsd,
      newCustomers,
      totalCustomers,
      activeAccounts,
      growthRate: Math.round(growthRate * 10) / 10, // Round to 1 decimal
      totalProducts,
      totalMotorcycles,
      totalInvoices,
    })
  } catch (error) {
    console.error("Error fetching dashboard statistics:", error)
    return NextResponse.json(
      { error: "Failed to fetch dashboard statistics" },
      { status: 500 }
    )
  }
}

