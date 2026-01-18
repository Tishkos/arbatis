import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'

/**
 * GET /api/search
 * Universal search across products, motorcycles, invoices, sales, and customers
 * Query params: q (search query), limit (max results per category, default 5)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q') || ''
    const limit = Math.min(parseInt(searchParams.get('limit') || '5'), 20)

    if (!query || query.trim().length < 2) {
      return NextResponse.json({
        products: [],
        motorcycles: [],
        invoices: [],
        customers: [],
        total: 0
      })
    }

    const searchTerm = query.trim()

    // Parallel searches for performance
    const [products, motorcycles, invoices, customers] = await Promise.all([
      // Search Products
      prisma.product.findMany({
        where: {
          OR: [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { nameAr: { contains: searchTerm, mode: 'insensitive' } },
            { nameKu: { contains: searchTerm, mode: 'insensitive' } },
            { sku: { contains: searchTerm, mode: 'insensitive' } },
            { barcode: { contains: searchTerm, mode: 'insensitive' } },
            { description: { contains: searchTerm, mode: 'insensitive' } },
          ],
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          sku: true,
          image: true,
          stockQuantity: true,
          mufradPrice: true,
          jumlaPrice: true,
        },
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
      }),

      // Search Motorcycles - try new schema first, fallback to old schema
      (async () => {
        try {
          // Try new schema (with name field)
          return await prisma.motorcycle.findMany({
            where: {
              OR: [
                { name: { contains: searchTerm, mode: 'insensitive' } },
                { sku: { contains: searchTerm, mode: 'insensitive' } },
              ],
              status: 'IN_STOCK',
            },
            select: {
              id: true,
              name: true,
              sku: true,
              image: true,
              stockQuantity: true,
              usdRetailPrice: true,
              usdWholesalePrice: true,
            },
            take: limit,
            orderBy: {
              createdAt: 'desc',
            },
          })
        } catch (schemaError: any) {
          // If new schema fails, try old schema (brand/model)
          if (schemaError?.message?.includes('name') || schemaError?.code === 'P2009') {
            try {
              const oldResults = await (prisma.motorcycle.findMany as any)({
                where: {
                  OR: [
                    { brand: { contains: searchTerm, mode: 'insensitive' } },
                    { model: { contains: searchTerm, mode: 'insensitive' } },
                    { sku: { contains: searchTerm, mode: 'insensitive' } },
                    { vin: { contains: searchTerm, mode: 'insensitive' } },
                    { color: { contains: searchTerm, mode: 'insensitive' } },
                  ],
                  status: 'IN_STOCK',
                },
                select: {
                  id: true,
                  brand: true,
                  model: true,
                  sku: true,
                  image: true,
                  stockQuantity: true,
                  usdRetailPrice: true,
                  usdWholesalePrice: true,
                },
                take: limit,
                orderBy: {
                  createdAt: 'desc',
                },
              })
              // Transform old schema to new schema format
              return oldResults.map((m: any) => ({
                ...m,
                name: `${m.brand || ''} ${m.model || ''}`.trim() || 'Motorcycle',
              }))
            } catch {
              return []
            }
          } else {
            throw schemaError
          }
        }
      })(),

      // Search Invoices (by invoice number, customer name, customer SKU)
      // Invoice numbers are in format: customerName-YYYY-MM-DD-RANDOMCODE
      // We search for partial matches in the invoice number (including the code at the end)
      prisma.invoice.findMany({
        where: {
          OR: [
            // Search invoice number (case-insensitive partial match)
            { invoiceNumber: { contains: searchTerm, mode: 'insensitive' } },
            // Search customer name
            { customer: { name: { contains: searchTerm, mode: 'insensitive' } } },
            // Search customer SKU
            { customer: { sku: { contains: searchTerm, mode: 'insensitive' } } },
            // Search notes
            { notes: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          invoiceNumber: true,
          total: true,
          status: true,
          invoiceDate: true,
          customer: {
            select: {
              id: true,
              name: true,
              sku: true,
            },
          },
        },
        take: limit,
        orderBy: {
          invoiceDate: 'desc',
        },
      }).catch((error) => {
        console.error('Error searching invoices:', error)
        return []
      }),

      // Search Customers
      prisma.customer.findMany({
        where: {
          OR: [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { nameAr: { contains: searchTerm, mode: 'insensitive' } },
            { sku: { contains: searchTerm, mode: 'insensitive' } },
            { phone: { contains: searchTerm, mode: 'insensitive' } },
            { email: { contains: searchTerm, mode: 'insensitive' } },
            { city: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          name: true,
          sku: true,
          phone: true,
          email: true,
          city: true,
          image: true,
          currentBalance: true,
        },
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
      }),
    ])

    const total = products.length + motorcycles.length + invoices.length + customers.length

    // Log search results for debugging
    if (searchTerm.length >= 2) {
      console.log(`Search for "${searchTerm}": Found ${invoices.length} invoices`)
    }

    return NextResponse.json({
      products: products.map(p => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        image: p.image,
        stockQuantity: p.stockQuantity,
        mufradPrice: p.mufradPrice,
        jumlaPrice: p.jumlaPrice,
        type: 'product',
      })),
      motorcycles: motorcycles.map((m: any) => ({
        id: m.id,
        name: m.name || 'Motorcycle',
        sku: m.sku,
        image: m.image,
        stockQuantity: m.stockQuantity,
        usdRetailPrice: m.usdRetailPrice,
        usdWholesalePrice: m.usdWholesalePrice,
        type: 'motorcycle',
      })),
      invoices: invoices.map(i => ({
        id: i.id,
        invoiceNumber: i.invoiceNumber,
        total: Number(i.total),
        status: i.status,
        invoiceDate: i.invoiceDate.toISOString(),
        customer: i.customer,
        type: 'invoice',
      })),
      customers: customers.map(c => ({
        id: c.id,
        name: c.name,
        sku: c.sku,
        phone: c.phone,
        email: c.email,
        city: c.city,
        image: c.image,
        currentBalance: c.currentBalance,
        type: 'customer',
      })),
      total,
    })
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

