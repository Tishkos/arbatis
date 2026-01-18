import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { writeFile, mkdir, unlink } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'

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

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }

    // Calculate days overdue
    let daysOverdue = 0
    const hasDebt = Number(customer.debtIqd) > 0 || Number(customer.debtUsd) > 0
    if (customer.lastPaymentDate && hasDebt) {
      const lastPayment = new Date(customer.lastPaymentDate)
      const now = new Date()
      // Calculate days since last payment (not absolute - only count if payment is in the past)
      const diffTime = now.getTime() - lastPayment.getTime()
      const daysSincePayment = Math.floor(diffTime / (1000 * 60 * 60 * 24))
      // Only set as overdue if payment was in the past (positive days)
      daysOverdue = daysSincePayment > 0 ? daysSincePayment : 0
    } else if (!hasDebt) {
      daysOverdue = 0
    }

    // Fetch address separately if addressId exists (with try-catch in case Prisma client not regenerated)
    let addressData = null
    if (customer.addressId) {
      try {
        // Try to access Address model - will fail if Prisma client not regenerated
        const address = await (prisma as any).address?.findUnique({
          where: { id: customer.addressId },
          select: { id: true, name: true },
        })
        addressData = address || null
      } catch (e) {
        // Address model might not be available yet, ignore
        console.warn('Address model not available yet:', e)
        addressData = null
      }
    }

    return NextResponse.json({
      ...customer,
      daysOverdue,
      debtIqd: Number(customer.debtIqd),
      debtUsd: Number(customer.debtUsd),
      currentBalance: Number(customer.currentBalance),
      address: addressData,
    })
  } catch (error) {
    console.error('Error fetching customer:', error)
    return NextResponse.json(
      { error: 'Failed to fetch customer' },
      { status: 500 }
    )
  }
}

export async function PUT(
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
    const existingImage = formData.get('existingImage') as string | null
    const removeImage = formData.get('removeImage') === 'true'
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
    
    // Validate SKU is numeric and in range 1000-9999
    const skuNum = parseInt(sku.trim())
    if (isNaN(skuNum) || skuNum < 1000 || skuNum > 9999) {
      return NextResponse.json(
        { error: 'Customer code must be a number between 1000 and 9999' },
        { status: 400 }
      )
    }

    // Get current customer
    const currentCustomer = await prisma.customer.findUnique({
      where: { id },
    })

    if (!currentCustomer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }

    // Check if SKU already exists (excluding current)
    if (sku.trim() !== currentCustomer.sku) {
      const existingCustomer = await prisma.customer.findUnique({
        where: { sku: sku.trim() },
      })

      if (existingCustomer) {
        return NextResponse.json(
          { error: 'This Code (SKU) is already in use by another customer. Please choose a different code.' },
          { status: 400 }
        )
      }
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

    let imageUrl: string | null = currentCustomer.image

    // Handle image update/deletion
    if (removeImage && currentCustomer.image) {
      // Delete old image file
      const oldImagePath = join(process.cwd(), 'public', currentCustomer.image)
      if (existsSync(oldImagePath)) {
        try {
          await unlink(oldImagePath)
        } catch (err) {
          console.error('Error deleting old image:', err)
        }
      }
      imageUrl = null
    } else if (imageFile) {
      // Delete old image if exists
      if (currentCustomer.image) {
        const oldImagePath = join(process.cwd(), 'public', currentCustomer.image)
        if (existsSync(oldImagePath)) {
          try {
            await unlink(oldImagePath)
          } catch (err) {
            console.error('Error deleting old image:', err)
          }
        }
      }

      // Validate file type
      const fileExtension = imageFile.name.split('.').pop()?.toLowerCase() || ''
      const allowedExtensions = ['png', 'jpg', 'jpeg']
      if (!allowedExtensions.includes(fileExtension)) {
        return NextResponse.json(
          { error: 'Only PNG and JPG images are allowed' },
          { status: 400 }
        )
      }

      // Validate file size
      if (imageFile.size > 5 * 1024 * 1024) {
        return NextResponse.json(
          { error: 'Image size must be less than 5MB' },
          { status: 400 }
        )
      }

      const bytes = await imageFile.arrayBuffer()
      const buffer = Buffer.from(bytes)

      // Compress image (lazy load sharp only when needed)
      let compressedBuffer: Buffer
      try {
        const sharp = (await import('sharp')).default
        compressedBuffer = await sharp(buffer)
          .resize(800, 800, {
            fit: 'inside',
            withoutEnlargement: true,
          })
          .jpeg({ quality: 85, progressive: true })
          .toBuffer()
      } catch (sharpError) {
        // If sharp fails to load (e.g., Windows Application Control), use original buffer
        console.warn('Sharp not available, using original image:', sharpError)
        compressedBuffer = buffer
      }

      // Create customers directory
      const customersDir = join(process.cwd(), 'public', 'customers')
      if (!existsSync(customersDir)) {
        await mkdir(customersDir, { recursive: true })
      }

      // Generate filename
      const sanitizedSku = sku
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
      
      const fileName = `${sanitizedSku}.jpg`
      const filePath = join(customersDir, fileName)

      await writeFile(filePath, compressedBuffer)
      imageUrl = `/customers/${fileName}`
    } else if (existingImage) {
      imageUrl = existingImage
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
    
    // Parse existing attachments
    if (existingAttachmentsStr) {
      try {
        const existing = JSON.parse(existingAttachmentsStr)
        if (Array.isArray(existing)) {
          attachmentUrls = [...existing]
        }
      } catch (e) {
        // If current customer has attachments, use them
        if (currentCustomer.attachment) {
          try {
            const parsed = JSON.parse(currentCustomer.attachment)
            if (Array.isArray(parsed)) {
              attachmentUrls = parsed
            }
          } catch (e) {
            // Ignore
          }
        }
      }
    } else if (currentCustomer.attachment) {
      // Keep existing attachments if not specified
      try {
        const parsed = JSON.parse(currentCustomer.attachment)
        if (Array.isArray(parsed)) {
          attachmentUrls = parsed
        }
      } catch (e) {
        // Ignore
      }
    }
    
    // Add new attachments
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
        if (attachmentFile.size > 10 * 1024 * 1024) {
          return NextResponse.json(
            { error: `Attachment "${attachmentFile.name}" exceeds 10MB limit` },
            { status: 400 }
          )
        }

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

    // Update customer
    const updatedCustomer = await prisma.customer.update({
      where: { id },
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
      },
    })

    return NextResponse.json({
      success: true,
      customer: updatedCustomer,
    })
  } catch (error) {
    console.error('Error updating customer:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to update customer'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

export async function DELETE(
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

    // Get customer to delete image
    const customer = await prisma.customer.findUnique({
      where: { id },
    })

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }

    // Delete image file if exists
    if (customer.image) {
      const imagePath = join(process.cwd(), 'public', customer.image)
      if (existsSync(imagePath)) {
        try {
          await unlink(imagePath)
        } catch (err) {
          console.error('Error deleting image:', err)
        }
      }
    }

    // Delete customer
    await prisma.customer.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    console.error('Error deleting customer:', error)
    return NextResponse.json(
      { error: 'Failed to delete customer' },
      { status: 500 }
    )
  }
}

