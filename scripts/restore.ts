#!/usr/bin/env tsx
/**
 * Restore Script
 * Imports data from a JSON backup file
 * 
 * Usage:
 *   npm run restore -- backups/arbati-backup-2026-01-10.json
 *   npm run restore -- backups/backup.json --clear-existing
 *   npm run restore -- backups/backup.json --skip-images
 */

import { PrismaClient } from '@prisma/client'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

const prisma = new PrismaClient()

interface RestoreOptions {
  file: string
  clearExisting?: boolean
  skipImages?: boolean
}

async function saveBase64Image(base64: string | null, originalUrl: string | null, subfolder: string, skipImages: boolean): Promise<string | null> {
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

async function processAttachments(attachments: Array<{ url: string, base64?: string }> | null, subfolder: string, skipImages: boolean): Promise<string | null> {
  if (!attachments || !Array.isArray(attachments) || attachments.length === 0) return null

  const processedUrls: string[] = []
  for (const attachment of attachments) {
    if (attachment.base64) {
      const savedUrl = await saveBase64Image(attachment.base64, attachment.url, subfolder, skipImages)
      if (savedUrl) processedUrls.push(savedUrl)
    } else if (attachment.url) {
      processedUrls.push(attachment.url)
    }
  }

  return processedUrls.length > 0 ? JSON.stringify(processedUrls) : null
}

async function restoreData(options: RestoreOptions) {
  const { file, clearExisting = false, skipImages = false } = options

  console.log('Starting data restore...')
  console.log(`Input file: ${file}`)
  console.log(`Clear existing: ${clearExisting}`)
  console.log(`Skip images: ${skipImages}`)

  // Read backup file
  if (!existsSync(file)) {
    throw new Error(`Backup file not found: ${file}`)
  }

  const fileContent = await readFile(file, 'utf-8')
  const data = JSON.parse(fileContent)

  if (!data.data) {
    throw new Error('Invalid backup file format')
  }

  console.log(`\nBackup info:`)
  console.log(`  Version: ${data.version || 'unknown'}`)
  console.log(`  Export Date: ${data.exportDate || 'unknown'}`)
  console.log(`  Exported By: ${data.exportedBy || 'unknown'}`)

  const results: any = {
    imported: {},
    errors: []
  }

  // Clear existing data if requested
  if (clearExisting) {
    console.log('\n⚠️  Clearing existing data...')
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
    console.log('✅ Existing data cleared')
  }

  // Import addresses
  if (data.data.addresses) {
    console.log(`\nImporting ${data.data.addresses.length} addresses...`)
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
      console.log(`  ✅ Imported ${addresses.length} addresses`)
    } catch (error) {
      results.errors.push({ type: 'addresses', error: error instanceof Error ? error.message : 'Unknown error' })
      console.log(`  ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Import categories
  if (data.data.categories) {
    console.log(`\nImporting ${data.data.categories.length} categories...`)
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
      console.log(`  ✅ Imported ${categories.length} categories`)
    } catch (error) {
      results.errors.push({ type: 'categories', error: error instanceof Error ? error.message : 'Unknown error' })
      console.log(`  ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Import products
  if (data.data.products) {
    console.log(`\nImporting ${data.data.products.length} products...`)
    try {
      let imported = 0
      for (const product of data.data.products) {
        const imageUrl = await saveBase64Image(product.imageBase64, product.image, 'products', skipImages)
        const attachments = await processAttachments(product.attachments, 'attachments', skipImages)
        
        await prisma.product.upsert({
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
            isActive: product.isActive ?? true,
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
        imported++
        if (imported % 10 === 0) {
          process.stdout.write(`  Imported ${imported}/${data.data.products.length}...\r`)
        }
      }
      results.imported.products = imported
      console.log(`  ✅ Imported ${imported} products`)
    } catch (error) {
      results.errors.push({ type: 'products', error: error instanceof Error ? error.message : 'Unknown error' })
      console.log(`  ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Import motorcycles
  if (data.data.motorcycles) {
    console.log(`\nImporting ${data.data.motorcycles.length} motorcycles...`)
    try {
      let imported = 0
      for (const motorcycle of data.data.motorcycles) {
        const imageUrl = await saveBase64Image(motorcycle.imageBase64, motorcycle.image, 'products', skipImages)
        const attachments = await processAttachments(motorcycle.attachments, 'attachments', skipImages)
        
        await prisma.motorcycle.upsert({
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
        imported++
      }
      results.imported.motorcycles = imported
      console.log(`  ✅ Imported ${imported} motorcycles`)
    } catch (error) {
      results.errors.push({ type: 'motorcycles', error: error instanceof Error ? error.message : 'Unknown error' })
      console.log(`  ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Import customers
  if (data.data.customers) {
    console.log(`\nImporting ${data.data.customers.length} customers...`)
    try {
      let imported = 0
      for (const customer of data.data.customers) {
        const imageUrl = await saveBase64Image(customer.imageBase64, customer.image, 'customers', skipImages)
        const attachments = await processAttachments(customer.attachments, 'attachments', skipImages)
        
        await prisma.customer.upsert({
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
        imported++
        if (imported % 10 === 0) {
          process.stdout.write(`  Imported ${imported}/${data.data.customers.length}...\r`)
        }
      }
      results.imported.customers = imported
      console.log(`  ✅ Imported ${imported} customers`)
    } catch (error) {
      results.errors.push({ type: 'customers', error: error instanceof Error ? error.message : 'Unknown error' })
      console.log(`  ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Import customer balances (payments)
  if (data.data.customerBalances) {
    console.log(`\nImporting ${data.data.customerBalances.length} customer balances...`)
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
      console.log(`  ✅ Imported ${result.count} customer balances`)
    } catch (error) {
      results.errors.push({ type: 'customerBalances', error: error instanceof Error ? error.message : 'Unknown error' })
      console.log(`  ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Import users
  if (data.data.users && !clearExisting) {
    console.log(`\nImporting ${data.data.users.length} users...`)
    console.log(`  ⚠️  Note: User passwords will be reset - users must use password reset`)
    try {
      let imported = 0
      for (const user of data.data.users) {
        const imageUrl = await saveBase64Image(user.imageBase64, user.image, 'profiles', skipImages)
        await prisma.user.upsert({
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
            passwordHash: '$2a$10$dummy.hash.users.must.reset.password',
            name: user.name,
            phone: user.phone,
            image: imageUrl,
            status: user.status,
            role: user.role,
            createdAt: new Date(user.createdAt || new Date()),
            updatedAt: new Date(user.updatedAt || new Date()),
          },
        })
        imported++
      }
      results.imported.users = imported
      console.log(`  ✅ Imported ${imported} users`)
    } catch (error) {
      results.errors.push({ type: 'users', error: error instanceof Error ? error.message : 'Unknown error' })
      console.log(`  ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Import invoices (simplified - only essential data)
  if (data.data.invoices) {
    console.log(`\nImporting ${data.data.invoices.length} invoices...`)
    console.log(`  ⚠️  Note: This is a simplified import. Some relations may need manual adjustment.`)
    try {
      let imported = 0
      for (const invoice of data.data.invoices.slice(0, 1000)) { // Limit to prevent timeouts
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
          if (imported % 50 === 0) {
            process.stdout.write(`  Imported ${imported}/${Math.min(data.data.invoices.length, 1000)}...\r`)
          }
        } catch (err: any) {
          // Skip duplicates (P2002) or other errors
          if (err.code !== 'P2002') {
            console.error(`Error importing invoice ${invoice.id}:`, err)
          }
        }
      }
      results.imported.invoices = imported
      console.log(`  ✅ Imported ${imported} invoices`)
    } catch (error) {
      results.errors.push({ type: 'invoices', error: error instanceof Error ? error.message : 'Unknown error' })
      console.log(`  ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  console.log(`\n✅ Restore completed!`)
  console.log(`\nSummary:`)
  Object.entries(results.imported).forEach(([key, value]) => {
    console.log(`  ${key}: ${value}`)
  })
  if (results.errors.length > 0) {
    console.log(`\n⚠️  Errors:`)
    results.errors.forEach((err: any) => {
      console.log(`  ${err.type}: ${err.error}`)
    })
  }
}

async function main() {
  const args = process.argv.slice(2)
  
  if (args.length === 0) {
    console.error('Usage: npm run restore -- <backup-file.json> [--clear-existing] [--skip-images]')
    process.exit(1)
  }

  const options: RestoreOptions = {
    file: args[0],
    clearExisting: args.includes('--clear-existing'),
    skipImages: args.includes('--skip-images'),
  }

  try {
    await restoreData(options)
  } catch (error) {
    console.error('Error restoring data:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()

