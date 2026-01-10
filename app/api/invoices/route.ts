import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'

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
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '20'), 100)
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || undefined
    const type = searchParams.get('type') || undefined
    const sortBy = searchParams.get('sortBy') || 'invoiceDate'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    const skip = (page - 1) * pageSize

    // Build where clause
    const conditions: Prisma.InvoiceWhereInput[] = []

    // Search filter
    if (search) {
      conditions.push({
        OR: [
          { invoiceNumber: { contains: search, mode: 'insensitive' } },
          { notes: { contains: search, mode: 'insensitive' } },
          { customer: { name: { contains: search, mode: 'insensitive' } } },
          { customer: { sku: { contains: search, mode: 'insensitive' } } },
        ],
      })
    }

    // Status filter
    if (status) {
      conditions.push({ status: status as any })
    }

    // Type filter - we'll filter after fetching since type detection requires checking items/notes
    // For now, we'll fetch all and filter in memory, or we can add type detection logic here
    // Since type detection is complex (requires checking items), we'll handle it after fetching

    // Build final where clause
    const where: Prisma.InvoiceWhereInput = conditions.length > 0 
      ? { AND: conditions }
      : {}

    // Build orderBy - handle relation fields specially
    let orderBy: Prisma.InvoiceOrderByWithRelationInput
    
    if (sortBy === 'customer') {
      // For customer relation, sort by customer name
      orderBy = {
        customer: {
          name: sortOrder,
        },
      } as Prisma.InvoiceOrderByWithRelationInput
    } else if (sortBy === 'createdBy') {
      // For createdBy relation, sort by user name
      orderBy = {
        createdBy: {
          name: sortOrder,
        },
      } as Prisma.InvoiceOrderByWithRelationInput
    } else {
      // For direct invoice fields, use simple orderBy
      orderBy = {
        [sortBy]: sortOrder,
      } as Prisma.InvoiceOrderByWithRelationInput
    }

    // Helper function to detect invoice type
    const getInvoiceType = (invoice: any): string => {
      // Check if it's a payment invoice
      if (invoice.notes) {
        const notes = invoice.notes.toUpperCase()
        if (notes.includes('PAYMENT') || notes.includes('PAYMENT INVOICE')) {
          return 'PAYMENT'
        }
      }
      
      // Check invoice items for payment markers
      if (invoice.items && invoice.items.length > 0) {
        const hasPayment = invoice.items.some((item: any) => {
          if (item.notes) {
            const itemNotes = item.notes.toUpperCase().trim()
            if (itemNotes.startsWith('PAYMENT:')) {
              return true
            }
          }
          return false
        })
        if (hasPayment) {
          return 'PAYMENT'
        }
      }
      
      // Check if it's a motorcycle invoice
      const isMotorcycle = (() => {
        // Method 1: Check invoice notes
        if (invoice.notes) {
          const notes = invoice.notes.toUpperCase()
          if (notes.includes('[INVOICE_TYPE:') && notes.includes('MOTORCYCLE')) {
            return true
          }
        }
        
        // Method 2: Check invoice items
        if (invoice.items && invoice.items.length > 0) {
          const hasMotorcycle = invoice.items.some((item: any) => {
            if (!item.productId && item.notes) {
              const notes = item.notes.toUpperCase().trim()
              if (notes.startsWith('MOTORCYCLE:')) {
                return true
              }
            }
            const productName = item.product?.name?.toLowerCase() || ''
            const itemNotes = item.notes?.toLowerCase() || ''
            if (productName.includes('motorcycle') || itemNotes.startsWith('motorcycle:')) {
              return true
            }
            return false
          })
          if (hasMotorcycle) {
            return true
          }
        }
        return false
      })()
      
      const isWholesale = invoice.sale?.type === 'JUMLA'
      const isRetail = invoice.sale?.type === 'MUFRAD'
      
      if (isWholesale && isMotorcycle) {
        return 'WHOLESALE_MOTORCYCLE'
      } else if (isWholesale) {
        return 'WHOLESALE_PRODUCT'
      } else if (isRetail && isMotorcycle) {
        return 'RETAIL_MOTORCYCLE'
      } else if (isRetail) {
        return 'RETAIL_PRODUCT'
      }
      
      return 'UNKNOWN'
    }

    // Get invoices - if type filter is applied, we need to fetch all and filter in memory
    // Otherwise, use pagination at database level
    const shouldFetchAll = !!type
    const fetchLimit = shouldFetchAll ? undefined : pageSize
    const fetchSkip = shouldFetchAll ? undefined : skip

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              sku: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          sale: {
            select: {
              type: true,
            },
          },
          items: {
            select: {
              id: true,
              productId: true,
              quantity: true,
              unitPrice: true,
              discount: true,
              taxRate: true,
              lineTotal: true,
              notes: true,
              order: true,
              product: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                },
              },
            },
            // Don't limit items - we need to check all items to detect motorcycle invoices
            // take: 5, // Removed limit to ensure we can detect motorcycle invoices
          },
        },
        orderBy,
        skip: fetchSkip,
        take: fetchLimit,
      }),
      prisma.invoice.count({ where }),
    ])

    // Convert Decimal to number
    let invoicesWithNumbers = invoices.map((invoice) => ({
      ...invoice,
      subtotal: Number(invoice.subtotal),
      taxAmount: Number(invoice.taxAmount),
      discount: Number(invoice.discount),
      total: Number(invoice.total),
      amountPaid: Number(invoice.amountPaid),
      amountDue: Number(invoice.amountDue),
      invoiceDate: invoice.invoiceDate.toISOString(),
      dueDate: invoice.dueDate?.toISOString() || null,
      paidAt: invoice.paidAt?.toISOString() || null,
      createdAt: invoice.createdAt.toISOString(),
      updatedAt: invoice.updatedAt.toISOString(),
      items: invoice.items.map((item) => ({
        ...item,
        unitPrice: Number(item.unitPrice),
        discount: Number(item.discount),
        taxRate: Number(item.taxRate),
        lineTotal: Number(item.lineTotal),
      })),
    }))

    // Filter by type if specified
    if (type) {
      invoicesWithNumbers = invoicesWithNumbers.filter((invoice) => {
        const invoiceType = getInvoiceType(invoice)
        return invoiceType === type
      })
    }

    // Recalculate total and pagination after filtering
    const filteredTotal = type ? invoicesWithNumbers.length : total
    const totalPages = Math.ceil(filteredTotal / pageSize)
    
    // Apply pagination after filtering (if type filter is applied)
    let paginatedInvoices = invoicesWithNumbers
    if (type) {
      const filterSkip = (page - 1) * pageSize
      paginatedInvoices = invoicesWithNumbers.slice(filterSkip, filterSkip + pageSize)
    }

    return NextResponse.json({
      invoices: paginatedInvoices || [],
      pagination: {
        page,
        pageSize,
        total: filteredTotal || 0,
        totalPages: totalPages || 0,
      },
    })
  } catch (error) {
    console.error('Error fetching invoices:', error)
    return NextResponse.json({
      invoices: [],
      pagination: {
        page: 1,
        pageSize: 20,
        total: 0,
        totalPages: 0,
      },
      error: 'Failed to fetch invoices',
    }, { status: 500 })
  }
}

