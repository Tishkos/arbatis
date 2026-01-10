import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || searchParams.get("pageSize") || "20")
    const search = searchParams.get("search") || ""
    const skip = (page - 1) * limit

    // Build where clause - if limit is high (like 500+), don't filter by date (for charts)
    // Otherwise, filter for today's invoices only (for activities table)
    const today = new Date()
    today.setHours(0, 0, 0, 0) // Start of today
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1) // Start of tomorrow (end of today)

    const where: any = {}
    
    // Only filter by today if limit is small (for activities table)
    if (limit <= 100) {
      where.invoiceDate = {
        gte: today, // Greater than or equal to start of today
        lt: tomorrow, // Less than start of tomorrow
      }
    }
    
    if (search) {
      // If there's a search, combine filters
      const searchFilter = {
        OR: [
          { invoiceNumber: { contains: search, mode: "insensitive" } },
          { customer: { name: { contains: search, mode: "insensitive" } } },
          { customer: { sku: { contains: search, mode: "insensitive" } } },
          { notes: { contains: search, mode: "insensitive" } },
        ],
      }
      
      if (limit <= 100 && where.invoiceDate) {
        // For activities table: combine date and search
        where.AND = [
          {
            invoiceDate: where.invoiceDate,
          },
          searchFilter,
        ]
        delete where.invoiceDate
      } else {
        // For charts: just add search filter
        where.AND = [searchFilter]
      }
    }

    // Get total count for pagination (only if limit is small, otherwise skip counting for performance)
    const total = limit > 100 ? 0 : await prisma.invoice.count({ where })

    // Get invoices with pagination
    const recentInvoices = await prisma.invoice.findMany({
      skip: limit > 100 ? 0 : skip, // Don't skip if getting all for charts
      take: limit,
      orderBy: {
        invoiceDate: limit > 100 ? "asc" : "desc", // Ascending for charts, desc for activities table
      },
      where,
      include: {
        customer: {
          select: {
            name: true,
            sku: true,
          },
        },
        createdBy: {
          select: {
            name: true,
          },
        },
        sale: {
          select: {
            type: true,
          },
        },
        items: {
          select: {
            productId: true,
            notes: true,
            product: {
              select: {
                name: true,
              },
            },
          },
        },
        draft: {
          select: {
            items: {
              select: {
                productId: true,
                notes: true,
              },
            },
          },
        },
      },
    })

    // Format activities with proper currency detection
    const activities = recentInvoices.map((invoice) => {
      const saleType = invoice.sale?.type || null
      
      // Determine if it's a motorcycle invoice
      // Method 1: Check invoice notes for invoice type
      let isMotorcycle = false
      if (invoice.notes) {
        const notes = invoice.notes.toUpperCase()
        if (notes.includes('[INVOICE_TYPE:') && notes.includes('MOTORCYCLE')) {
          isMotorcycle = true
        }
      }
      
      // Method 2: Check invoice items for motorcycle markers
      if (!isMotorcycle && invoice.items && invoice.items.length > 0) {
        isMotorcycle = invoice.items.some((item: any) => {
          // Primary check: If productId is null and notes exist, check if it's a motorcycle
          if (!item.productId && item.notes) {
            const notes = item.notes.toUpperCase().trim()
            if (notes.startsWith('MOTORCYCLE:')) {
              return true
            }
          }
          // Secondary check: Check product name
          const productName = item.product?.name?.toLowerCase() || ''
          const itemNotes = item.notes?.toLowerCase() || ''
          return productName.includes('motorcycle') || itemNotes.startsWith('motorcycle:')
        })
      }
      
      // Method 3: Check draft items if invoice items don't have notes
      if (!isMotorcycle && invoice.draft?.items) {
        isMotorcycle = invoice.draft.items.some((item: any) => {
          if (!item.productId && item.notes) {
            const notes = item.notes.toUpperCase().trim()
            return notes.startsWith('MOTORCYCLE:')
          }
          return false
        })
      }
      
      const currency = isMotorcycle ? 'USD' : 'IQD'
      
      return {
        id: invoice.id,
        type: "invoice",
        title: invoice.invoiceNumber,
        description: null, // Will be translated on frontend
        customer: invoice.customer ? {
          name: invoice.customer.name,
          sku: invoice.customer.sku,
        } : null,
        amount: Number(invoice.total),
        status: invoice.status,
        date: invoice.invoiceDate || invoice.createdAt,
        createdBy: invoice.createdBy?.name || null,
        invoiceNumber: invoice.invoiceNumber,
        saleType: saleType,
        isMotorcycle: isMotorcycle,
        isProduct: !isMotorcycle,
        currency: currency,
      }
    })

    return NextResponse.json({ 
      activities,
      pagination: limit > 100 ? undefined : {
        page,
        pageSize: limit,
        total,
        totalPages: Math.ceil(total / limit),
      }
    })
  } catch (error) {
    console.error("Error fetching activities:", error)
    return NextResponse.json(
      { error: "Failed to fetch activities" },
      { status: 500 }
    )
  }
}

