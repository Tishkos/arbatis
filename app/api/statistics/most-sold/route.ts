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

    // Get most sold products by aggregating SaleItem and InvoiceItem quantities
    // When invoices are created, only SaleItems are created initially
    // InvoiceItems are only created when invoices are updated
    // So we need to check both to get complete data
    
    // Get from SaleItem (primary source - created when invoices are finalized)
    // First fetch SaleItems with completed sales, then group
    let saleItemProducts: any[] = []
    try {
      const saleItems = await prisma.saleItem.findMany({
        where: {
          productId: {
            not: null,
          },
          sale: {
            status: "COMPLETED",
          },
        },
        select: {
          productId: true,
          quantity: true,
        },
      })
      
      // Group by productId and sum quantities
      const saleItemMap = new Map<string, number>()
      saleItems.forEach((item) => {
        if (item.productId) {
          const current = saleItemMap.get(item.productId) || 0
          saleItemMap.set(item.productId, current + Number(item.quantity))
        }
      })
      
      saleItemProducts = Array.from(saleItemMap.entries()).map(([productId, quantity]) => ({
        productId,
        _sum: { quantity },
      }))
      
      console.log(`Found ${saleItemProducts.length} products from SaleItem`)
    } catch (saleError) {
      console.error('Error querying SaleItem:', saleError)
    }
    
    // Get from InvoiceItem (for edited/updated invoices)
    // First fetch InvoiceItems with non-cancelled invoices, then group
    let invoiceItemProducts: any[] = []
    try {
      const invoiceItems = await prisma.invoiceItem.findMany({
        where: {
          productId: {
            not: null,
          },
          invoice: {
            status: {
              not: "CANCELLED",
            },
          },
        },
        select: {
          productId: true,
          quantity: true,
        },
      })
      
      // Group by productId and sum quantities
      const invoiceItemMap = new Map<string, number>()
      invoiceItems.forEach((item) => {
        if (item.productId) {
          const current = invoiceItemMap.get(item.productId) || 0
          invoiceItemMap.set(item.productId, current + Number(item.quantity))
        }
      })
      
      invoiceItemProducts = Array.from(invoiceItemMap.entries()).map(([productId, quantity]) => ({
        productId,
        _sum: { quantity },
      }))
      
      console.log(`Found ${invoiceItemProducts.length} products from InvoiceItem`)
    } catch (invoiceError) {
      console.error('Error querying InvoiceItem:', invoiceError)
    }
    
    // Combine and sum quantities by productId
    const productMap = new Map<string, number>()
    
    saleItemProducts.forEach((item) => {
      if (item.productId) {
        const current = productMap.get(item.productId) || 0
        productMap.set(item.productId, current + (item._sum.quantity || 0))
      }
    })
    
    invoiceItemProducts.forEach((item) => {
      if (item.productId) {
        const current = productMap.get(item.productId) || 0
        productMap.set(item.productId, current + (item._sum.quantity || 0))
      }
    })
    
    // Convert to array and sort by quantity
    let mostSoldProducts = Array.from(productMap.entries())
      .map(([productId, totalQuantity]) => ({
        productId,
        _sum: { quantity: totalQuantity },
      }))
      .sort((a, b) => (b._sum.quantity || 0) - (a._sum.quantity || 0))
      .slice(0, 10)
    
    console.log(`Total unique products found: ${mostSoldProducts.length}`)

    // Fetch product details for the most sold products
    const productIds = mostSoldProducts
      .map((item) => item.productId)
      .filter((id): id is string => id !== null)

    // If no products found, return empty array
    if (productIds.length === 0) {
      return NextResponse.json({ products: [] })
    }

    const products = await prisma.product.findMany({
      where: {
        id: {
          in: productIds,
        },
      },
      select: {
        id: true,
        name: true,
        sku: true,
        image: true,
      },
    })

    // Combine with quantities
    const productsWithQuantities = mostSoldProducts.map((item) => {
      const product = products.find((p) => p.id === item.productId)
      return {
        id: product?.id || item.productId || "",
        name: product?.name || "Unknown Product",
        sku: product?.sku || "N/A",
        image: product?.image || null,
        totalSold: item._sum.quantity || 0,
      }
    })

    return NextResponse.json({ products: productsWithQuantities })
  } catch (error) {
    console.error("Error fetching most sold products:", error)
    return NextResponse.json(
      { error: "Failed to fetch most sold products" },
      { status: 500 }
    )
  }
}

