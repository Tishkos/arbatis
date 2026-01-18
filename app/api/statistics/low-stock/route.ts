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
    let allMotorcycles: any[] = []
    try {
      // Try new schema first (with name field)
      allMotorcycles = await prisma.motorcycle.findMany({
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
          name: true,
          sku: true,
          stockQuantity: true,
          lowStockThreshold: true,
          image: true,
        },
      })
    } catch (schemaError: any) {
      // If new schema fails, try old schema (brand/model)
      if (schemaError?.message?.includes('name') || schemaError?.code === 'P2009') {
        try {
          const oldSchemaMotorcycles = await (prisma.motorcycle.findMany as any)({
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
          // Transform old schema to new schema format
          allMotorcycles = oldSchemaMotorcycles.map((m: any) => ({
            ...m,
            name: `${m.brand || ''} ${m.model || ''}`.trim() || 'Motorcycle',
          }))
        } catch {
          // If both fail, use empty array
          allMotorcycles = []
        }
      } else {
        throw schemaError
      }
    }

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
        displayName: (motorcycle as any).name || 'Motorcycle',
      }))

    // Combine and limit to 20 items total
    const allLowStockItems = [...lowStockProducts, ...lowStockMotorcycles]
      .sort((a, b) => a.stockQuantity - b.stockQuantity)
      .slice(0, 20)

    return NextResponse.json({ 
      products: lowStockProducts || [],
      motorcycles: lowStockMotorcycles || [],
      items: allLowStockItems || [],
      totalCount: allLowStockItems?.length || 0,
    })
  } catch (error) {
    console.error("Error fetching low stock items:", error)
    return NextResponse.json(
      { 
        products: [],
        motorcycles: [],
        items: [],
        totalCount: 0,
        error: "Failed to fetch low stock items" 
      },
      { status: 500 }
    )
  }
}

