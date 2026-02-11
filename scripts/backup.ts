#!/usr/bin/env tsx
/**
 * Backup Script
 * Exports all data from the database to a JSON file including images
 * 
 * Usage:
 *   npm run backup                    # Export to ./backups/arbati-backup-YYYY-MM-DD.json
 *   npm run backup -- --output custom.json
 *   npm run backup -- --include-images=false
 */

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL is required')
const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

interface BackupOptions {
  output?: string
  includeImages?: boolean
}

async function imageToBase64(imagePath: string | null, includeImages: boolean): Promise<string | null> {
  if (!imagePath || !includeImages) return imagePath
  
  try {
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

async function processAttachments(attachmentJson: string | null, includeImages: boolean): Promise<Array<{ url: string, base64?: string }>> {
  if (!attachmentJson) return []
  
  try {
    const urls = JSON.parse(attachmentJson)
    if (!Array.isArray(urls)) return []
    
    const processed = await Promise.all(urls.map(async (url: string) => {
      const base64 = await imageToBase64(url, includeImages)
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

async function exportData(options: BackupOptions) {
  const { output, includeImages = true } = options
  
  console.log('Starting data export...')
  console.log(`Include images: ${includeImages}`)

  const exportData: any = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    exportedBy: 'cli-script',
    data: {}
  }

  // 1. Categories
  console.log('Exporting categories...')
  const categories = await prisma.category.findMany({ orderBy: { name: 'asc' } })
  exportData.data.categories = categories

  // 2. Products
  console.log('Exporting products...')
  const products = await prisma.product.findMany({
    include: { category: true },
    orderBy: { name: 'asc' }
  })
  exportData.data.products = await Promise.all(products.map(async (product) => ({
    ...product,
    imageBase64: await imageToBase64(product.image, includeImages),
    attachments: await processAttachments(product.attachment || null, includeImages),
  })))

  // 3. Motorcycles
  console.log('Exporting motorcycles...')
  const motorcycles = await prisma.motorcycle.findMany({ orderBy: { name: 'asc' } })
  exportData.data.motorcycles = await Promise.all(motorcycles.map(async (motorcycle) => ({
    ...motorcycle,
    imageBase64: await imageToBase64(motorcycle.image, includeImages),
    attachments: await processAttachments(motorcycle.attachment || null, includeImages),
  })))

  // 4. Addresses
  console.log('Exporting addresses...')
  const addresses = await prisma.address.findMany({ orderBy: { name: 'asc' } })
  exportData.data.addresses = addresses

  // 5. Customers
  console.log('Exporting customers...')
  const customers = await prisma.customer.findMany({
    include: { address: true },
    orderBy: { name: 'asc' }
  })
  exportData.data.customers = await Promise.all(customers.map(async (customer) => ({
    ...customer,
    imageBase64: await imageToBase64(customer.image, includeImages),
    attachments: await processAttachments(customer.attachment || null, includeImages),
  })))

  // 6. Customer Balances
  console.log('Exporting customer balances...')
  const customerBalances = await prisma.customerBalance.findMany({ orderBy: { createdAt: 'asc' } })
  exportData.data.customerBalances = customerBalances

  // 7. Users (without password hashes)
  console.log('Exporting users...')
  const users = await prisma.user.findMany({
    select: {
      id: true, email: true, name: true, phone: true, image: true,
      status: true, role: true, createdAt: true, updatedAt: true,
      createdById: true, updatedById: true,
    },
    orderBy: { email: 'asc' }
  })
  exportData.data.users = await Promise.all(users.map(async (user) => ({
    ...user,
    imageBase64: await imageToBase64(user.image, includeImages),
  })))

  // 8. Employees
  console.log('Exporting employees...')
  const employees = await prisma.employee.findMany({
    include: { roles: { include: { role: true } } },
    orderBy: { createdAt: 'asc' }
  })
  exportData.data.employees = employees

  // 9. Drafts
  console.log('Exporting drafts...')
  const drafts = await prisma.draft.findMany({
    include: {
      items: { include: { product: true }, orderBy: { order: 'asc' } },
      customer: true,
    },
    orderBy: { createdAt: 'desc' }
  })
  exportData.data.drafts = drafts

  // 10. Sales
  console.log('Exporting sales...')
  const sales = await prisma.sale.findMany({
    include: {
      items: { include: { product: true }, orderBy: { order: 'asc' } },
      customer: true,
    },
    orderBy: { createdAt: 'desc' }
  })
  exportData.data.sales = sales

  // 11. Invoices
  console.log('Exporting invoices...')
  const invoices = await prisma.invoice.findMany({
    include: {
      items: { include: { product: true }, orderBy: { order: 'asc' } },
      customer: true, sale: true, draft: true,
      createdBy: { select: { id: true, email: true, name: true } },
    },
    orderBy: { createdAt: 'desc' }
  })
  exportData.data.invoices = invoices

  // 12. Stock Movements
  console.log('Exporting stock movements...')
  const stockMovements = await prisma.stockMovement.findMany({
    include: { product: true },
    orderBy: { createdAt: 'desc' }
  })
  exportData.data.stockMovements = stockMovements

  // 13. Activities
  console.log('Exporting activities...')
  const activities = await prisma.activity.findMany({
    include: {
      createdBy: { select: { id: true, email: true, name: true } },
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

  // Determine output file
  const dateStr = new Date().toISOString().split('T')[0]
  const defaultFileName = `arbati-backup-${dateStr}.json`
  const outputFile = output || join(process.cwd(), 'backups', defaultFileName)

  // Ensure backups directory exists
  const backupsDir = join(process.cwd(), 'backups')
  if (!existsSync(backupsDir)) {
    await mkdir(backupsDir, { recursive: true })
  }

  // Write file
  await writeFile(outputFile, JSON.stringify(exportData, null, 2), 'utf-8')
  
  console.log(`\n✅ Export completed successfully!`)
  console.log(`📁 File: ${outputFile}`)
  console.log(`\nSummary:`)
  console.log(`  Categories: ${exportData.summary.categories}`)
  console.log(`  Products: ${exportData.summary.products}`)
  console.log(`  Motorcycles: ${exportData.summary.motorcycles}`)
  console.log(`  Customers: ${exportData.summary.customers}`)
  console.log(`  Invoices: ${exportData.summary.invoices}`)
  console.log(`  Sales: ${exportData.summary.sales}`)
  console.log(`  Payments: ${exportData.summary.customerBalances}`)
}

async function main() {
  const args = process.argv.slice(2)
  const options: BackupOptions = {
    includeImages: true,
  }

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--output' && args[i + 1]) {
      options.output = args[i + 1]
      i++
    } else if (args[i] === '--include-images' && args[i + 1]) {
      options.includeImages = args[i + 1] === 'true'
      i++
    }
  }

  try {
    await exportData(options)
  } catch (error) {
    console.error('Error exporting data:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()

