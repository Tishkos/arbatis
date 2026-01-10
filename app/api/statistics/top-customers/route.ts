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

    // Get top customers by invoice count (number of orders)
    const topCustomers = await prisma.sale.groupBy({
      by: ["customerId"],
      _sum: {
        total: true,
      },
      _count: {
        id: true,
      },
      where: {
        customerId: {
          not: null,
        },
        status: "COMPLETED",
      },
      orderBy: {
        _count: {
          id: "desc",
        },
      },
      take: 10,
    })

    // Fetch customer details
    const customerIds = topCustomers
      .map((item) => item.customerId)
      .filter((id): id is string => id !== null)

    const customers = await prisma.customer.findMany({
      where: {
        id: {
          in: customerIds,
        },
      },
      select: {
        id: true,
        name: true,
        sku: true,
        image: true,
      },
    })

    // Combine with totals
    const customersWithTotals = topCustomers.map((item) => {
      const customer = customers.find((c) => c.id === item.customerId)
      return {
        ...customer,
        totalSales: Number(item._sum.total || 0),
        totalOrders: item._count.id || 0,
      }
    })

    return NextResponse.json({ customers: customersWithTotals })
  } catch (error) {
    console.error("Error fetching top customers:", error)
    return NextResponse.json(
      { error: "Failed to fetch top customers" },
      { status: 500 }
    )
  }
}



