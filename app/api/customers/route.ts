import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import sharp from 'sharp'

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
    const pageSize = parseInt(searchParams.get('pageSize') || '20')
    const search = searchParams.get('search') || ''
    const sortBy = searchParams.get('sortBy') || 'name'
    const sortOrder = searchParams.get('sortOrder') || 'asc'

    const skip = (page - 1) * pageSize

    // Build where clause
    const where: any = {}
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ]
    }

    // Build orderBy
    const orderBy: any = {}
    orderBy[sortBy] = sortOrder

    // Get total count
    const total = await prisma.customer.count({ where })

    // Get customers
    // Note: If you get errors about missing fields, run: npx prisma generate
    const customers = await prisma.customer.findMany({
      where,
      skip,
      take: pageSize,
      orderBy,
    } as any) // Using 'as any' temporarily until Prisma client is regenerated

    // Calculate days overdue for each customer and update in database
    const customersWithOverdue = await Promise.all(customers.map(async (customer) => {
      try {
        let daysOverdue = 0
        const hasDebt = Number(customer.debtIqd) > 0 || Number(customer.debtUsd) > 0
        
        // Only calculate if there was a payment entry (lastPaymentDate exists) and customer has debt
        if (customer.lastPaymentDate && hasDebt) {
          const lastPayment = new Date(customer.lastPaymentDate)
          const now = new Date()
          // Calculate days since last payment (not absolute - only count if payment is in the past)
          const diffTime = now.getTime() - lastPayment.getTime()
          const daysSincePayment = Math.floor(diffTime / (1000 * 60 * 60 * 24))
          
          // Only set as overdue if payment was in the past (positive days)
          daysOverdue = daysSincePayment > 0 ? daysSincePayment : 0
          
          // Update daysOverdue in database if it changed
          if (customer.daysOverdue !== daysOverdue) {
            await prisma.customer.update({
              where: { id: customer.id },
              data: { daysOverdue },
            })
          }
        } else if (!hasDebt) {
          // Reset days overdue if no debt
          daysOverdue = 0
          if (customer.daysOverdue !== 0) {
            await prisma.customer.update({
              where: { id: customer.id },
              data: { daysOverdue: 0 },
            })
          }
        } else {
          // Has debt but no lastPaymentDate - set to 0 (can't calculate)
          daysOverdue = 0
          if (customer.daysOverdue !== 0) {
            await prisma.customer.update({
              where: { id: customer.id },
              data: { daysOverdue: 0 },
            })
          }
        }
        
        // Fetch address separately if addressId exists (with try-catch in case Prisma client not regenerated)
        let addressData = null
        const customerAddressId = (customer as any).addressId
        if (customerAddressId) {
          try {
            // Try to access Address model - will fail if Prisma client not regenerated
            const addressModel = (prisma as any).address
            if (addressModel && typeof addressModel.findUnique === 'function') {
              const address = await addressModel.findUnique({
                where: { id: customerAddressId },
                select: { id: true, name: true },
              })
              addressData = address || null
            }
          } catch (e: any) {
            // Address model might not be available yet, ignore
            if (!e?.message?.includes('address')) {
              console.warn('Address model not available yet:', e?.message || e)
            }
            addressData = null
          }
        }
        
        return {
          ...customer,
          daysOverdue: hasDebt && customer.lastPaymentDate ? daysOverdue : 0,
          debtIqd: Number(customer.debtIqd),
          debtUsd: Number(customer.debtUsd),
          currentBalance: Number(customer.currentBalance),
          address: addressData,
          addressId: (customer as any).addressId || null,
          notificationDays: (customer as any).notificationDays || null,
          notificationType: (customer as any).notificationType || null,
        }
      } catch (error) {
        console.error('Error processing customer:', customer.id, error)
        // Return customer data without address if there's an error
        return {
          ...customer,
          daysOverdue: 0,
          debtIqd: Number(customer.debtIqd),
          debtUsd: Number(customer.debtUsd),
          currentBalance: Number(customer.currentBalance),
          address: null,
          addressId: (customer as any).addressId || null,
          notificationDays: (customer as any).notificationDays || null,
          notificationType: (customer as any).notificationType || null,
        }
      }
    }))

    return NextResponse.json({
      customers: customersWithOverdue,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  } catch (error) {
    console.error('Error fetching customers:', error)
    return NextResponse.json(
      { error: 'Failed to fetch customers' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const formData = await request.formData()
    const name = formData.get('name') as string
    const sku = formData.get('sku') as string
    const type = (formData.get('type') as string) || 'INDIVIDUAL'
    const phone = formData.get('phone') as string | null
    const email = formData.get('email') as string | null
    const addressId = formData.get('addressId') as string | null
    const newAddressName = formData.get('newAddressName') as string | null
    const debtIqd = formData.get('debtIqd') as string
    const debtUsd = formData.get('debtUsd') as string
    const notes = formData.get('notes') as string | null
    const notificationDays = formData.get('notificationDays') as string | null
    const notificationType = formData.get('notificationType') as string | null
    const imageFile = formData.get('image') as File | null
    const attachmentFiles = formData.getAll('attachments') as File[]
    const existingAttachmentsStr = formData.get('existingAttachments') as string | null

    // Validate required fields
    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      )
    }
    if (!sku || !sku.trim()) {
      return NextResponse.json(
        { error: 'Code (SKU) is required' },
        { status: 400 }
      )
    }

    // Check if SKU already exists
    const existingCustomer = await prisma.customer.findUnique({
      where: { sku: sku.trim() },
    })

    if (existingCustomer) {
      return NextResponse.json(
        { error: 'This Code (SKU) is already in use by another customer. Please choose a different code.' },
        { status: 400 }
      )
    }

    // Get current user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    let imageUrl: string | null = null

    // Handle image upload with compression
    if (imageFile) {
      // Validate file type (only PNG and JPG)
      const fileExtension = imageFile.name.split('.').pop()?.toLowerCase() || ''
      const allowedExtensions = ['png', 'jpg', 'jpeg']
      if (!allowedExtensions.includes(fileExtension)) {
        return NextResponse.json(
          { error: 'Only PNG and JPG images are allowed' },
          { status: 400 }
        )
      }

      // Validate file size (max 5MB)
      if (imageFile.size > 5 * 1024 * 1024) {
        return NextResponse.json(
          { error: 'Image size must be less than 5MB' },
          { status: 400 }
        )
      }

      const bytes = await imageFile.arrayBuffer()
      const buffer = Buffer.from(bytes)

      // Compress image using Sharp
      const compressedBuffer = await sharp(buffer)
        .resize(800, 800, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: 85, progressive: true })
        .toBuffer()

      // Create customers directory if it doesn't exist
      const customersDir = join(process.cwd(), 'public', 'customers')
      if (!existsSync(customersDir)) {
        await mkdir(customersDir, { recursive: true })
      }

      // Generate filename based on SKU (sanitized)
      const sanitizedSku = sku
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
      
      const fileName = `${sanitizedSku}.jpg`
      const filePath = join(customersDir, fileName)

      // Save compressed file
      await writeFile(filePath, compressedBuffer)

      // Generate URL
      imageUrl = `/customers/${fileName}`
    }

    // Handle address
    let finalAddressId: string | null = null
    if (newAddressName && newAddressName.trim()) {
      try {
        // Check if Address model exists in Prisma client
        if ((prisma as any).address) {
          // Check if address already exists (case-insensitive)
          const existingAddress = await (prisma as any).address.findFirst({
            where: {
              name: {
                equals: newAddressName.trim(),
                mode: 'insensitive',
              },
            },
          })

          if (existingAddress) {
            // Use existing address instead of creating duplicate
            finalAddressId = existingAddress.id
          } else {
            // Create new address only if it doesn't exist
            const newAddress = await (prisma as any).address.create({
              data: {
                name: newAddressName.trim(),
                createdById: user.id,
              },
            })
            finalAddressId = newAddress.id
          }
        }
      } catch (e) {
        console.warn('Address model not available yet:', e)
        // Continue without address if model not available
      }
    } else if (addressId) {
      finalAddressId = addressId
    }

    // Handle attachments
    const attachmentsDir = join(process.cwd(), 'public', 'attachments')
    let attachmentUrls: string[] = []
    
    if (attachmentFiles.length > 0) {
      if (!existsSync(attachmentsDir)) {
        await mkdir(attachmentsDir, { recursive: true })
      }

      const sanitizedSku = sku
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')

      for (const attachmentFile of attachmentFiles) {
        const fileExtension = attachmentFile.name.split('.').pop()?.toLowerCase() || ''
        const timestamp = Date.now()
        const randomStr = Math.random().toString(36).substring(2, 8)
        const fileName = `${sanitizedSku}_${timestamp}_${randomStr}.${fileExtension}`
        const filePath = join(attachmentsDir, fileName)

        const bytes = await attachmentFile.arrayBuffer()
        const buffer = Buffer.from(bytes)
        await writeFile(filePath, buffer)

        attachmentUrls.push(`/attachments/${fileName}`)
      }
    }

    // Parse existing attachments if editing
    if (existingAttachmentsStr) {
      try {
        const existing = JSON.parse(existingAttachmentsStr)
        if (Array.isArray(existing)) {
          attachmentUrls = [...existing, ...attachmentUrls]
        }
      } catch (e) {
        // Ignore parse errors
      }
    }

    // Create customer
    const customer = await prisma.customer.create({
      data: {
        name: name.trim(),
        sku: sku.trim(),
        type: type as 'INDIVIDUAL' | 'COMPANY',
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        addressId: finalAddressId,
        image: imageUrl,
        attachment: attachmentUrls.length > 0 ? JSON.stringify(attachmentUrls) : null,
        debtIqd: parseFloat(debtIqd || '0'),
        debtUsd: parseFloat(debtUsd || '0'),
        notes: notes?.trim() || null,
        notificationDays: notificationDays && notificationDays.trim() ? parseInt(notificationDays) : null,
        notificationType: notificationDays && notificationDays.trim() ? (notificationType || 'partial') : null,
        createdById: user.id,
      },
    })

    return NextResponse.json({
      success: true,
      customer,
    })
  } catch (error) {
    console.error('Error creating customer:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to create customer'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

