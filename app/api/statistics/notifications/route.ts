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

    // Get all active products with low stock threshold > 0
    const allProducts = await prisma.product.findMany({
      where: {
        isActive: true,
        lowStockThreshold: {
          gt: 0,
        },
      },
      select: {
        id: true,
        name: true,
        sku: true,
        stockQuantity: true,
        lowStockThreshold: true,
        image: true,
      },
    })

    // Get all motorcycles with low stock threshold > 0
    const allMotorcycles = await prisma.motorcycle.findMany({
      where: {
        status: {
          in: ['IN_STOCK', 'RESERVED'],
        },
        lowStockThreshold: {
          gt: 0,
        },
      },
      select: {
        id: true,
        brand: true,
        model: true,
        sku: true,
        stockQuantity: true,
        lowStockThreshold: true,
        image: true,
      },
    })

    // Filter products where stockQuantity <= lowStockThreshold
    const lowStockProducts = allProducts
      .filter((product) => product.stockQuantity <= product.lowStockThreshold)
      .sort((a, b) => a.stockQuantity - b.stockQuantity)
      .map((product) => ({
        ...product,
        type: 'product' as const,
        displayName: product.name,
      }))

    // Filter motorcycles where stockQuantity <= lowStockThreshold
    const lowStockMotorcycles = allMotorcycles
      .filter((motorcycle) => motorcycle.stockQuantity <= motorcycle.lowStockThreshold)
      .sort((a, b) => a.stockQuantity - b.stockQuantity)
      .map((motorcycle) => ({
        ...motorcycle,
        type: 'motorcycle' as const,
        displayName: `${motorcycle.brand} ${motorcycle.model}`,
      }))

    // Get customers with overdue payments
    // A customer is overdue if:
    // 1. They have debt (debtIqd > 0 or debtUsd > 0)
    // 2. daysOverdue >= notificationDays (or >= 1 if notificationDays is null)
    // If notificationDays is null, use default threshold of 1 day
    const allCustomers = await prisma.customer.findMany({
      where: {
        OR: [
          { debtIqd: { gt: 0 } },
          { debtUsd: { gt: 0 } },
        ],
      },
      select: {
        id: true,
        name: true,
        sku: true,
        phone: true,
        email: true,
        image: true,
        debtIqd: true,
        debtUsd: true,
        daysOverdue: true,
        notificationDays: true,
        notificationType: true,
        lastPaymentDate: true,
      },
    })

    // Recalculate daysOverdue for each customer and filter
    const now = new Date()
    const DEFAULT_THRESHOLD = 1 // Default to 1 day if notificationDays is not set
    const filteredOverdueCustomers = allCustomers
      .map((customer) => {
        let daysOverdue = customer.daysOverdue
        const hasDebt = Number(customer.debtIqd) > 0 || Number(customer.debtUsd) > 0
        
        // Recalculate days overdue if lastPaymentDate exists and customer has debt
        if (customer.lastPaymentDate && hasDebt) {
          const lastPayment = new Date(customer.lastPaymentDate)
          // Calculate days since last payment (not absolute - only count if payment is in the past)
          const diffTime = now.getTime() - lastPayment.getTime()
          const daysSincePayment = Math.floor(diffTime / (1000 * 60 * 60 * 24))
          // Only set as overdue if payment was in the past (positive days)
          daysOverdue = daysSincePayment > 0 ? daysSincePayment : 0
        } else if (!hasDebt) {
          daysOverdue = 0
        } else {
          // Has debt but no lastPaymentDate - set to 0 (can't calculate)
          daysOverdue = 0
        }
        
        return {
          ...customer,
          daysOverdue,
        }
      })
      .filter((customer) => {
        // Use notificationDays if set, otherwise use default threshold of 1 day
        const threshold = customer.notificationDays !== null ? customer.notificationDays : DEFAULT_THRESHOLD
        const hasDebt = Number(customer.debtIqd) > 0 || Number(customer.debtUsd) > 0
        return hasDebt && customer.daysOverdue >= threshold
      })
      .sort((a, b) => b.daysOverdue - a.daysOverdue) // Sort by most overdue first
      .map((customer) => ({
        id: customer.id,
        name: customer.name,
        sku: customer.sku,
        phone: customer.phone,
        email: customer.email,
        image: customer.image,
        debtIqd: Number(customer.debtIqd),
        debtUsd: Number(customer.debtUsd),
        daysOverdue: customer.daysOverdue,
        notificationDays: customer.notificationDays,
        notificationType: customer.notificationType,
        lastPaymentDate: customer.lastPaymentDate,
        type: 'customer' as const,
        displayName: customer.name,
      }))

    // Combine all low stock items
    const allLowStockItems = [...lowStockProducts, ...lowStockMotorcycles]
      .sort((a, b) => a.stockQuantity - b.stockQuantity)
      .slice(0, 20)

    const totalCount = allLowStockItems.length + filteredOverdueCustomers.length

    return NextResponse.json({ 
      products: lowStockProducts || [],
      motorcycles: lowStockMotorcycles || [],
      items: allLowStockItems || [],
      customers: filteredOverdueCustomers || [],
      totalCount,
    })
  } catch (error) {
    console.error("Error fetching notifications:", error)
    return NextResponse.json(
      { 
        products: [],
        motorcycles: [],
        items: [],
        customers: [],
        totalCount: 0,
        error: "Failed to fetch notifications" 
      },
      { status: 500 }
    )
  }
}

