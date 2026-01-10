import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

/**
 * Import data from JSON backup
 * Usage: POST /api/backup/import
 * Body: { data: {...}, options: { clearExisting: boolean, skipImages: boolean } }
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { data, options = {} } = body
    const { clearExisting = false, skipImages = false } = options

    if (!data || !data.data) {
      return NextResponse.json({ error: 'Invalid backup data format' }, { status: 400 })
    }

    // Helper to save base64 image to file
    const saveBase64Image = async (base64: string | null, originalUrl: string | null, subfolder: string): Promise<string | null> => {
      if (!base64 || skipImages || !base64.startsWith('data:')) {
        return originalUrl
      }

      try {
        const matches = base64.match(/^data:image\/([^;]+);base64,(.+)$/)
        if (!matches) return originalUrl

        const [, ext, base64Data] = matches
        const buffer = Buffer.from(base64Data, 'base64')
        const dir = join(process.cwd(), 'public', subfolder)
        
        if (!existsSync(dir)) {
          await mkdir(dir, { recursive: true })
        }

        const timestamp = Date.now()
        const randomStr = Math.random().toString(36).substring(2, 8)
        const fileName = `${timestamp}_${randomStr}.${ext}`
        const filePath = join(dir, fileName)

        await writeFile(filePath, buffer)
        return `/${subfolder}/${fileName}`
      } catch (error) {
        console.error(`Error saving image:`, error)
        return originalUrl
      }
    }

    // Helper to process attachments
    const processAttachments = async (attachments: Array<{ url: string, base64?: string }> | null, subfolder: string): Promise<string | null> => {
      if (!attachments || !Array.isArray(attachments) || attachments.length === 0) return null

      const processedUrls: string[] = []
      for (const attachment of attachments) {
        if (attachment.base64) {
          const savedUrl = await saveBase64Image(attachment.base64, attachment.url, subfolder)
          if (savedUrl) processedUrls.push(savedUrl)
        } else if (attachment.url) {
          processedUrls.push(attachment.url)
        }
      }

      return processedUrls.length > 0 ? JSON.stringify(processedUrls) : null
    }

    const results: any = {
      imported: {},
      errors: []
    }

    // Clear existing data if requested (CAREFUL!)
    if (clearExisting) {
      // Delete in correct order to respect foreign keys
      await prisma.activity.deleteMany()
      await prisma.stockMovement.deleteMany()
      await prisma.invoiceItem.deleteMany()
      await prisma.saleItem.deleteMany()
      await prisma.draftItem.deleteMany()
      await prisma.customerBalance.deleteMany()
      await prisma.invoice.deleteMany()
      await prisma.sale.deleteMany()
      await prisma.draft.deleteMany()
      await prisma.employeeRole.deleteMany()
      await prisma.employee.deleteMany()
      await prisma.customer.deleteMany()
      await prisma.motorcycle.deleteMany()
      await prisma.product.deleteMany()
      await prisma.category.deleteMany()
      await prisma.address.deleteMany()
      // Note: Users are NOT deleted for security
    }

    // Import in correct order (respecting foreign keys)

    // 1. Addresses (no dependencies)
    if (data.data.addresses) {
      try {
        const addresses = await Promise.all(
          data.data.addresses.map((addr: any) =>
            prisma.address.upsert({
              where: { id: addr.id },
              update: {
                name: addr.name,
                description: addr.description,
                updatedAt: new Date(addr.updatedAt || new Date()),
              },
              create: {
                id: addr.id,
                name: addr.name,
                description: addr.description,
                createdAt: new Date(addr.createdAt || new Date()),
                updatedAt: new Date(addr.updatedAt || new Date()),
              },
            })
          )
        )
        results.imported.addresses = addresses.length
      } catch (error) {
        results.errors.push({ type: 'addresses', error: error instanceof Error ? error.message : 'Unknown error' })
      }
    }

    // 2. Categories (no dependencies)
    if (data.data.categories) {
      try {
        const categories = await Promise.all(
          data.data.categories.map((cat: any) =>
            prisma.category.upsert({
              where: { id: cat.id },
              update: {
                name: cat.name,
                description: cat.description,
                parentId: cat.parentId,
                updatedAt: new Date(cat.updatedAt || new Date()),
              },
              create: {
                id: cat.id,
                name: cat.name,
                description: cat.description,
                parentId: cat.parentId,
                createdAt: new Date(cat.createdAt || new Date()),
                updatedAt: new Date(cat.updatedAt || new Date()),
              },
            })
          )
        )
        results.imported.categories = categories.length
      } catch (error) {
        results.errors.push({ type: 'categories', error: error instanceof Error ? error.message : 'Unknown error' })
      }
    }

    // 3. Users (skip password - users must reset)
    if (data.data.users && !clearExisting) {
      try {
        const users = await Promise.all(
          data.data.users.map(async (user: any) => {
            const imageUrl = await saveBase64Image(user.imageBase64, user.image, 'profiles')
            return prisma.user.upsert({
              where: { email: user.email },
              update: {
                name: user.name,
                phone: user.phone,
                image: imageUrl,
                status: user.status,
                role: user.role,
                updatedAt: new Date(user.updatedAt || new Date()),
              },
              create: {
                id: user.id,
                email: user.email,
                passwordHash: '$2a$10$dummy.hash.users.must.reset.password', // Dummy hash - user must reset
                name: user.name,
                phone: user.phone,
                image: imageUrl,
                status: user.status,
                role: user.role,
                createdAt: new Date(user.createdAt || new Date()),
                updatedAt: new Date(user.updatedAt || new Date()),
              },
            })
          })
        )
        results.imported.users = users.length
        results.usersNote = 'User passwords were reset. Users must use password reset.'
      } catch (error) {
        results.errors.push({ type: 'users', error: error instanceof Error ? error.message : 'Unknown error' })
      }
    }

    // 4. Products (depends on categories)
    if (data.data.products) {
      try {
        const products = await Promise.all(
          data.data.products.map(async (product: any) => {
            const imageUrl = await saveBase64Image(product.imageBase64, product.image, 'products')
            const attachments = await processAttachments(product.attachments, 'attachments')
            
            return prisma.product.upsert({
              where: { id: product.id },
              update: {
                name: product.name,
                nameAr: product.nameAr,
                nameKu: product.nameKu,
                sku: product.sku,
                barcode: product.barcode,
                description: product.description,
                purchasePrice: product.purchasePrice,
                mufradPrice: product.mufradPrice,
                jumlaPrice: product.jumlaPrice,
                rmbPrice: product.rmbPrice,
                defaultTaxRate: product.defaultTaxRate,
                stockQuantity: product.stockQuantity,
                lowStockThreshold: product.lowStockThreshold,
                image: imageUrl,
                attachment: attachments,
                notes: product.notes,
                isActive: product.isActive,
                categoryId: product.categoryId,
                updatedAt: new Date(product.updatedAt || new Date()),
              },
              create: {
                id: product.id,
                name: product.name,
                nameAr: product.nameAr,
                nameKu: product.nameKu,
                sku: product.sku,
                barcode: product.barcode,
                description: product.description,
                purchasePrice: product.purchasePrice,
                mufradPrice: product.mufradPrice,
                jumlaPrice: product.jumlaPrice,
                rmbPrice: product.rmbPrice,
                defaultTaxRate: product.defaultTaxRate,
                stockQuantity: product.stockQuantity,
                lowStockThreshold: product.lowStockThreshold,
                image: imageUrl,
                attachment: attachments,
                notes: product.notes,
                isActive: product.isActive ?? true,
                categoryId: product.categoryId,
                createdById: product.createdById,
                createdAt: new Date(product.createdAt || new Date()),
                updatedAt: new Date(product.updatedAt || new Date()),
              },
            })
          })
        )
        results.imported.products = products.length
      } catch (error) {
        results.errors.push({ type: 'products', error: error instanceof Error ? error.message : 'Unknown error' })
      }
    }

    // 5. Motorcycles
    if (data.data.motorcycles) {
      try {
        const motorcycles = await Promise.all(
          data.data.motorcycles.map(async (motorcycle: any) => {
            const imageUrl = await saveBase64Image(motorcycle.imageBase64, motorcycle.image, 'products')
            const attachments = await processAttachments(motorcycle.attachments, 'attachments')
            
            return prisma.motorcycle.upsert({
              where: { id: motorcycle.id },
              update: {
                brand: motorcycle.brand,
                model: motorcycle.model,
                sku: motorcycle.sku,
                year: motorcycle.year,
                engineSize: motorcycle.engineSize,
                vin: motorcycle.vin,
                color: motorcycle.color,
                image: imageUrl,
                attachment: attachments,
                usdRetailPrice: motorcycle.usdRetailPrice,
                usdWholesalePrice: motorcycle.usdWholesalePrice,
                rmbPrice: motorcycle.rmbPrice,
                stockQuantity: motorcycle.stockQuantity,
                lowStockThreshold: motorcycle.lowStockThreshold,
                status: motorcycle.status,
                notes: motorcycle.notes,
                updatedAt: new Date(motorcycle.updatedAt || new Date()),
              },
              create: {
                id: motorcycle.id,
                brand: motorcycle.brand,
                model: motorcycle.model,
                sku: motorcycle.sku,
                year: motorcycle.year,
                engineSize: motorcycle.engineSize,
                vin: motorcycle.vin,
                color: motorcycle.color,
                image: imageUrl,
                attachment: attachments,
                usdRetailPrice: motorcycle.usdRetailPrice,
                usdWholesalePrice: motorcycle.usdWholesalePrice,
                rmbPrice: motorcycle.rmbPrice,
                stockQuantity: motorcycle.stockQuantity,
                lowStockThreshold: motorcycle.lowStockThreshold,
                status: motorcycle.status,
                notes: motorcycle.notes,
                createdAt: new Date(motorcycle.createdAt || new Date()),
                updatedAt: new Date(motorcycle.updatedAt || new Date()),
              },
            })
          })
        )
        results.imported.motorcycles = motorcycles.length
      } catch (error) {
        results.errors.push({ type: 'motorcycles', error: error instanceof Error ? error.message : 'Unknown error' })
      }
    }

    // 6. Customers (depends on addresses)
    if (data.data.customers) {
      try {
        const customers = await Promise.all(
          data.data.customers.map(async (customer: any) => {
            const imageUrl = await saveBase64Image(customer.imageBase64, customer.image, 'customers')
            const attachments = await processAttachments(customer.attachments, 'attachments')
            
            return prisma.customer.upsert({
              where: { id: customer.id },
              update: {
                name: customer.name,
                nameAr: customer.nameAr,
                phone: customer.phone,
                email: customer.email,
                city: customer.city,
                addressId: customer.addressId,
                sku: customer.sku,
                type: customer.type,
                image: imageUrl,
                attachment: attachments,
                notes: customer.notes,
                debtIqd: customer.debtIqd,
                debtUsd: customer.debtUsd,
                currentBalance: customer.currentBalance,
                lastPaymentDate: customer.lastPaymentDate ? new Date(customer.lastPaymentDate) : null,
                daysOverdue: customer.daysOverdue,
                notificationDays: customer.notificationDays,
                notificationType: customer.notificationType,
                updatedAt: new Date(customer.updatedAt || new Date()),
              },
              create: {
                id: customer.id,
                name: customer.name,
                nameAr: customer.nameAr,
                phone: customer.phone,
                email: customer.email,
                city: customer.city,
                addressId: customer.addressId,
                sku: customer.sku,
                type: customer.type,
                image: imageUrl,
                attachment: attachments,
                notes: customer.notes,
                debtIqd: customer.debtIqd,
                debtUsd: customer.debtUsd,
                currentBalance: customer.currentBalance,
                lastPaymentDate: customer.lastPaymentDate ? new Date(customer.lastPaymentDate) : null,
                daysOverdue: customer.daysOverdue,
                notificationDays: customer.notificationDays,
                notificationType: customer.notificationType,
                createdById: customer.createdById,
                createdAt: new Date(customer.createdAt || new Date()),
                updatedAt: new Date(customer.updatedAt || new Date()),
              },
            })
          })
        )
        results.imported.customers = customers.length
      } catch (error) {
        results.errors.push({ type: 'customers', error: error instanceof Error ? error.message : 'Unknown error' })
      }
    }

    // 7. Customer Balances (Payments) - depends on customers
    if (data.data.customerBalances) {
      try {
        const balanceData = data.data.customerBalances.map((balance: any) => ({
          id: balance.id,
          customerId: balance.customerId,
          amount: balance.amount,
          balance: balance.balance,
          description: balance.description,
          saleId: balance.saleId,
          invoiceId: balance.invoiceId,
          createdAt: new Date(balance.createdAt || new Date()),
        }))
        
        const result = await prisma.customerBalance.createMany({
          data: balanceData,
          skipDuplicates: true,
        })
        results.imported.customerBalances = result.count
      } catch (error) {
        results.errors.push({ type: 'customerBalances', error: error instanceof Error ? error.message : 'Unknown error' })
      }
    }

    // 8. Employees - depends on users
    if (data.data.employees) {
      try {
        const employees = await Promise.all(
          data.data.employees.map((employee: any) =>
            prisma.employee.upsert({
              where: { id: employee.id },
              update: {
                userId: employee.userId,
                employeeNumber: employee.employeeNumber,
                department: employee.department,
                position: employee.position,
                updatedAt: new Date(employee.updatedAt || new Date()),
              },
              create: {
                id: employee.id,
                userId: employee.userId,
                employeeNumber: employee.employeeNumber,
                department: employee.department,
                position: employee.position,
                createdAt: new Date(employee.createdAt || new Date()),
                updatedAt: new Date(employee.updatedAt || new Date()),
              },
            })
          )
        )
        results.imported.employees = employees.length
      } catch (error) {
        results.errors.push({ type: 'employees', error: error instanceof Error ? error.message : 'Unknown error' })
      }
    }

    // 9. Drafts - depends on customers, users
    if (data.data.drafts) {
      try {
        let imported = 0
        for (const draft of data.data.drafts) {
          try {
            await prisma.draft.create({
              data: {
                id: draft.id,
                type: draft.type,
                status: draft.status,
                customerId: draft.customerId,
                subtotal: draft.subtotal,
                taxAmount: draft.taxAmount,
                discount: draft.discount,
                total: draft.total,
                paymentMethod: draft.paymentMethod,
                amountPaid: draft.amountPaid,
                notes: draft.notes,
                createdById: draft.createdById,
                createdAt: new Date(draft.createdAt || new Date()),
                updatedAt: new Date(draft.updatedAt || new Date()),
                items: {
                  create: (draft.items || []).map((item: any) => ({
                    id: item.id,
                    productId: item.productId,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    discount: item.discount,
                    taxRate: item.taxRate,
                    lineTotal: item.lineTotal,
                    notes: item.notes,
                    order: item.order,
                  }))
                }
              },
            })
            imported++
          } catch (err: any) {
            // Skip if duplicate or other error
            if (err.code !== 'P2002') {
              console.error(`Error importing draft ${draft.id}:`, err)
            }
          }
        }
        results.imported.drafts = imported
      } catch (error) {
        results.errors.push({ type: 'drafts', error: error instanceof Error ? error.message : 'Unknown error' })
      }
    }

    // 10. Sales - depends on customers, users, products
    if (data.data.sales) {
      try {
        let imported = 0
        for (const sale of data.data.sales) {
          try {
            await prisma.sale.create({
              data: {
                id: sale.id,
                type: sale.type,
                status: sale.status,
                customerId: sale.customerId,
                subtotal: sale.subtotal,
                taxAmount: sale.taxAmount,
                discount: sale.discount,
                total: sale.total,
                paymentMethod: sale.paymentMethod,
                amountPaid: sale.amountPaid,
                amountDue: sale.amountDue,
                createdById: sale.createdById,
                createdAt: new Date(sale.createdAt || new Date()),
                updatedAt: new Date(sale.updatedAt || new Date()),
                items: {
                  create: (sale.items || []).map((item: any) => ({
                    id: item.id,
                    productId: item.productId,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    discount: item.discount,
                    taxRate: item.taxRate,
                    lineTotal: item.lineTotal,
                    notes: item.notes,
                    order: item.order,
                  }))
                }
              },
            })
            imported++
          } catch (err: any) {
            // Skip if duplicate or other error
            if (err.code !== 'P2002') {
              console.error(`Error importing sale ${sale.id}:`, err)
            }
          }
        }
        results.imported.sales = imported
      } catch (error) {
        results.errors.push({ type: 'sales', error: error instanceof Error ? error.message : 'Unknown error' })
      }
    }

    // 11. Invoices - depends on sales, customers, users
    if (data.data.invoices) {
      try {
        let imported = 0
        for (const invoice of data.data.invoices) {
          try {
            await prisma.invoice.create({
              data: {
                id: invoice.id,
                invoiceNumber: invoice.invoiceNumber,
                status: invoice.status,
                subtotal: invoice.subtotal,
                taxAmount: invoice.taxAmount,
                discount: invoice.discount,
                total: invoice.total,
                amountPaid: invoice.amountPaid,
                amountDue: invoice.amountDue,
                invoiceDate: new Date(invoice.invoiceDate || new Date()),
                dueDate: invoice.dueDate ? new Date(invoice.dueDate) : null,
                paidAt: invoice.paidAt ? new Date(invoice.paidAt) : null,
                notes: invoice.notes,
                customerId: invoice.customerId,
                saleId: invoice.saleId,
                draftId: invoice.draftId,
                createdById: invoice.createdById,
                createdAt: new Date(invoice.createdAt || new Date()),
                updatedAt: new Date(invoice.updatedAt || new Date()),
                items: {
                  create: (invoice.items || []).map((item: any) => ({
                    id: item.id,
                    productId: item.productId,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    discount: item.discount,
                    taxRate: item.taxRate,
                    lineTotal: item.lineTotal,
                    notes: item.notes,
                    order: item.order,
                  }))
                }
              },
            })
            imported++
          } catch (err: any) {
            // Skip if duplicate or other error
            if (err.code !== 'P2002') {
              console.error(`Error importing invoice ${invoice.id}:`, err)
            }
          }
        }
        results.imported.invoices = imported
      } catch (error) {
        results.errors.push({ type: 'invoices', error: error instanceof Error ? error.message : 'Unknown error' })
      }
    }

    // 12. Stock Movements - depends on products
    if (data.data.stockMovements) {
      try {
        const movementData = data.data.stockMovements.map((movement: any) => ({
          id: movement.id,
          productId: movement.productId,
          type: movement.type,
          quantity: movement.quantity,
          reason: movement.reason,
          notes: movement.notes,
          createdById: movement.createdById,
          createdAt: new Date(movement.createdAt || new Date()),
        }))
        
        const result = await prisma.stockMovement.createMany({
          data: movementData,
          skipDuplicates: true,
        })
        results.imported.stockMovements = result.count
      } catch (error) {
        results.errors.push({ type: 'stockMovements', error: error instanceof Error ? error.message : 'Unknown error' })
      }
    }

    // 13. Activities - depends on users
    if (data.data.activities) {
      try {
        const activityData = data.data.activities.map((activity: any) => ({
          id: activity.id,
          type: activity.type,
          action: activity.action,
          entityType: activity.entityType,
          entityId: activity.entityId,
          description: activity.description,
          metadata: activity.metadata,
          createdById: activity.createdById,
          createdAt: new Date(activity.createdAt || new Date()),
        }))
        
        const result = await prisma.activity.createMany({
          data: activityData,
          skipDuplicates: true,
        })
        results.imported.activities = result.count
      } catch (error) {
        results.errors.push({ type: 'activities', error: error instanceof Error ? error.message : 'Unknown error' })
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Data imported successfully',
      results,
    })
  } catch (error) {
    console.error('Error importing data:', error)
    return NextResponse.json(
      { error: 'Failed to import data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

