import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

/**
 * Export all data as JSON including images as base64
 * Usage: GET /api/backup/export?includeImages=true
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only allow admin/developer roles
    const user = await prisma.user.findUnique({
      where: { email: session.user.email! },
      select: { role: true }
    })

    if (user?.role !== 'ADMIN' && user?.role !== 'DEVELOPER') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const includeImages = searchParams.get('includeImages') === 'true'

    // Helper to convert image to base64
    const imageToBase64 = async (imagePath: string | null): Promise<string | null> => {
      if (!imagePath || !includeImages) return imagePath
      
      try {
        // Remove leading slash if present
        const cleanPath = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath
        const fullPath = join(process.cwd(), 'public', cleanPath)
        
        if (existsSync(fullPath)) {
          const buffer = await readFile(fullPath)
          const base64 = buffer.toString('base64')
          const ext = cleanPath.split('.').pop()?.toLowerCase() || 'jpg'
          return `data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,${base64}`
        }
      } catch (error) {
        console.error(`Error converting image ${imagePath}:`, error)
      }
      return imagePath
    }

    // Helper to process attachments array
    const processAttachments = async (attachmentJson: string | null): Promise<Array<{ url: string, base64?: string }>> => {
      if (!attachmentJson) return []
      
      try {
        const urls = JSON.parse(attachmentJson)
        if (!Array.isArray(urls)) return []
        
        const processed = await Promise.all(urls.map(async (url: string) => {
          const base64 = await imageToBase64(url)
          return {
            url,
            ...(includeImages && base64 && base64.startsWith('data:') ? { base64 } : {})
          }
        }))
        return processed
      } catch {
        return []
      }
    }

    // Export all data
    const exportData: any = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      exportedBy: session.user.email,
      data: {}
    }

    // 1. Categories
    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' }
    })
    exportData.data.categories = categories

    // 2. Products with images
    const products = await prisma.product.findMany({
      include: {
        category: true,
      },
      orderBy: { name: 'asc' }
    })
    exportData.data.products = await Promise.all(products.map(async (product) => ({
      ...product,
      imageBase64: await imageToBase64(product.image),
      attachments: await processAttachments(product.attachment || null),
    })))

    // 3. Motorcycles with images
    const motorcycles = await prisma.motorcycle.findMany({
      orderBy: { brand: 'asc' }
    })
    exportData.data.motorcycles = await Promise.all(motorcycles.map(async (motorcycle) => ({
      ...motorcycle,
      imageBase64: await imageToBase64(motorcycle.image),
      attachments: await processAttachments(motorcycle.attachment || null),
    })))

    // 4. Addresses
    const addresses = await prisma.address.findMany({
      orderBy: { name: 'asc' }
    })
    exportData.data.addresses = addresses

    // 5. Customers with images
    const customers = await prisma.customer.findMany({
      include: {
        address: true,
      },
      orderBy: { name: 'asc' }
    })
    exportData.data.customers = await Promise.all(customers.map(async (customer) => ({
      ...customer,
      imageBase64: await imageToBase64(customer.image),
      attachments: await processAttachments(customer.attachment || null),
    })))

    // 6. Customer Balances (Payments)
    const customerBalances = await prisma.customerBalance.findMany({
      orderBy: { createdAt: 'asc' }
    })
    exportData.data.customerBalances = customerBalances

    // 7. Users (without password hashes for security)
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        image: true,
        status: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        createdById: true,
        updatedById: true,
      },
      orderBy: { email: 'asc' }
    })
    exportData.data.users = await Promise.all(users.map(async (user) => ({
      ...user,
      imageBase64: await imageToBase64(user.image),
    })))

    // 8. Employees
    const employees = await prisma.employee.findMany({
      include: {
        roles: {
          include: {
            role: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    })
    exportData.data.employees = employees

    // 9. Drafts
    const drafts = await prisma.draft.findMany({
      include: {
        items: {
          include: {
            product: true
          },
          orderBy: { order: 'asc' }
        },
        customer: true,
      },
      orderBy: { createdAt: 'desc' }
    })
    exportData.data.drafts = drafts

    // 10. Sales
    const sales = await prisma.sale.findMany({
      include: {
        items: {
          include: {
            product: true
          },
          orderBy: { order: 'asc' }
        },
        customer: true,
      },
      orderBy: { createdAt: 'desc' }
    })
    exportData.data.sales = sales

    // 11. Invoices
    const invoices = await prisma.invoice.findMany({
      include: {
        items: {
          include: {
            product: true
          },
          orderBy: { order: 'asc' }
        },
        customer: true,
        sale: true,
        draft: true,
        createdBy: {
          select: {
            id: true,
            email: true,
            name: true,
          }
        },
      },
      orderBy: { createdAt: 'desc' }
    })
    exportData.data.invoices = invoices

    // 12. Stock Movements
    const stockMovements = await prisma.stockMovement.findMany({
      include: {
        product: true,
      },
      orderBy: { createdAt: 'desc' }
    })
    exportData.data.stockMovements = stockMovements

    // 13. Activities
    const activities = await prisma.activity.findMany({
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            name: true,
          }
        },
      },
      orderBy: { createdAt: 'desc' }
    })
    exportData.data.activities = activities

    // Summary
    exportData.summary = {
      categories: categories.length,
      products: products.length,
      motorcycles: motorcycles.length,
      addresses: addresses.length,
      customers: customers.length,
      customerBalances: customerBalances.length,
      users: users.length,
      employees: employees.length,
      drafts: drafts.length,
      sales: sales.length,
      invoices: invoices.length,
      stockMovements: stockMovements.length,
      activities: activities.length,
    }

    return NextResponse.json(exportData, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="arbati-backup-${new Date().toISOString().split('T')[0]}.json"`
      }
    })
  } catch (error) {
    console.error('Error exporting data:', error)
    return NextResponse.json(
      { error: 'Failed to export data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

