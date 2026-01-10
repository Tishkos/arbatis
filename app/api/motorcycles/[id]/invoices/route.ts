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
    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type') || 'all' // 'wholesale', 'retail', or 'all'

    // Get the motorcycle to find its SKU
    const motorcycle = await prisma.motorcycle.findUnique({
      where: { id },
      select: { sku: true },
    })

    if (!motorcycle) {
      return NextResponse.json(
        { error: 'Motorcycle not found' },
        { status: 404 }
      )
    }

    // Find products with matching SKU
    const product = await prisma.product.findUnique({
      where: { sku: motorcycle.sku },
      select: { id: true },
    })

    if (!product) {
      // No product with matching SKU, return empty invoices
      return NextResponse.json({ invoices: [] })
    }

    // Build sale type filter
    let saleTypeFilter: 'MUFRAD' | 'JUMLA' | undefined
    if (type === 'retail') {
      saleTypeFilter = 'MUFRAD'
    } else if (type === 'wholesale') {
      saleTypeFilter = 'JUMLA'
    }

    // Find invoice items for this product
    const invoiceItems = await prisma.invoiceItem.findMany({
      where: {
        productId: product.id,
        ...(saleTypeFilter && {
          invoice: {
            sale: {
              type: saleTypeFilter,
            },
          },
        }),
      },
      include: {
        invoice: {
          include: {
            sale: {
              select: {
                type: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
    })

    // Transform to the format expected by the frontend
    const invoices = invoiceItems.map((item) => ({
      id: item.id,
      date: item.createdAt,
      invoiceNumber: item.invoice.invoiceNumber,
      quantity: item.quantity,
      price: Number(item.unitPrice),
      total: Number(item.lineTotal),
      status: item.invoice.status,
      notes: item.notes || undefined,
    }))

    return NextResponse.json({ invoices })
  } catch (error) {
    console.error('Error fetching motorcycle invoices:', error)
    return NextResponse.json(
      { error: 'Failed to fetch invoices' },
      { status: 500 }
    )
  }
}

