import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { writeFile, mkdir, unlink } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import sharp from 'sharp'
import { logActivity, createActivityDescription, getChanges } from '@/lib/activity-logger'

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

    const motorcycle = await prisma.motorcycle.findUnique({
      where: { id },
    })

    if (!motorcycle) {
      return NextResponse.json(
        { error: 'Motorcycle not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ motorcycle })
  } catch (error) {
    console.error('Error fetching motorcycle:', error)
    return NextResponse.json(
      { error: 'Failed to fetch motorcycle' },
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
    const brand = formData.get('brand') as string
    const model = formData.get('model') as string
    const sku = formData.get('sku') as string
    const year = formData.get('year') as string | null
    const engineSize = formData.get('engineSize') as string | null
    const vin = formData.get('vin') as string | null
    const color = formData.get('color') as string | null
    const usdRetailPrice = formData.get('usdRetailPrice') as string
    const usdWholesalePrice = formData.get('usdWholesalePrice') as string
    const rmbPrice = formData.get('rmbPrice') as string | null
    const stockQuantity = formData.get('stockQuantity') as string
    const lowStockThreshold = formData.get('lowStockThreshold') as string
    const status = formData.get('status') as string
    const notes = formData.get('notes') as string | null
    const imageFile = formData.get('image') as File | null
    const attachmentFiles = formData.getAll('attachments') as File[]
    const existingAttachmentsJson = formData.get('existingAttachments') as string | null

    // Validate required fields
    if (!brand || !brand.trim()) {
      return NextResponse.json(
        { error: 'Brand is required' },
        { status: 400 }
      )
    }
    if (!model || !model.trim()) {
      return NextResponse.json(
        { error: 'Model is required' },
        { status: 400 }
      )
    }
    if (!sku || !sku.trim()) {
      return NextResponse.json(
        { error: 'SKU is required' },
        { status: 400 }
      )
    }
    if (!usdRetailPrice || parseFloat(usdRetailPrice) <= 0) {
      return NextResponse.json(
        { error: 'USD Retail price must be greater than 0' },
        { status: 400 }
      )
    }
    if (!usdWholesalePrice || parseFloat(usdWholesalePrice) <= 0) {
      return NextResponse.json(
        { error: 'USD Wholesale price must be greater than 0' },
        { status: 400 }
      )
    }

    // Get current motorcycle
    const currentMotorcycle = await prisma.motorcycle.findUnique({
      where: { id },
    })

    if (!currentMotorcycle) {
      return NextResponse.json(
        { error: 'Motorcycle not found' },
        { status: 404 }
      )
    }

    // Check if SKU already exists in products or motorcycles (excluding current)
    if (sku.trim() !== currentMotorcycle.sku) {
      const existingProduct = await prisma.product.findUnique({
        where: { sku: sku.trim() },
      })

      if (existingProduct) {
        return NextResponse.json(
          { error: 'SKU already exists in products' },
          { status: 400 }
        )
      }

      const existingMotorcycle = await prisma.motorcycle.findUnique({
        where: { sku: sku.trim() },
      })

      if (existingMotorcycle) {
        return NextResponse.json(
          { error: 'SKU already exists in motorcycles' },
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

    let imageUrl: string | null = currentMotorcycle.image

    // Handle image upload with compression (if new image provided)
    if (imageFile) {
      const fileExtension = imageFile.name.split('.').pop()?.toLowerCase() || ''
      const allowedExtensions = ['png', 'jpg', 'jpeg']
      if (!allowedExtensions.includes(fileExtension)) {
        return NextResponse.json(
          { error: 'Only PNG and JPG images are allowed' },
          { status: 400 }
        )
      }

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

      const productsDir = join(process.cwd(), 'public', 'products')
      if (!existsSync(productsDir)) {
        await mkdir(productsDir, { recursive: true })
      }

      // Delete old image if exists
      if (currentMotorcycle.image) {
        const oldImagePath = join(process.cwd(), 'public', currentMotorcycle.image)
        if (existsSync(oldImagePath)) {
          try {
            await unlink(oldImagePath)
          } catch (err) {
            console.error('Error deleting old image:', err)
          }
        }
      }

      const sanitizedSku = sku
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
      
      const fileName = `${sanitizedSku}.jpg`
      const filePath = join(productsDir, fileName)

      await writeFile(filePath, compressedBuffer)
      imageUrl = `/products/${fileName}`
    }

    // Handle multiple attachment uploads
    const newAttachmentUrls: string[] = []
    const attachmentsDir = join(process.cwd(), 'public', 'attachments')
    
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

        const bytes = await attachmentFile.arrayBuffer()
        const buffer = Buffer.from(bytes)
        
        const fileName = `${sanitizedSku}_${Date.now()}_${Math.random().toString(36).substring(7)}.${attachmentFile.name.split('.').pop()}`
        const filePath = join(attachmentsDir, fileName)

        await writeFile(filePath, buffer)
        newAttachmentUrls.push(`/attachments/${fileName}`)
      }
    }

    // Parse existing attachments
    let existingAttachmentUrls: string[] = []
    if (existingAttachmentsJson) {
      try {
        existingAttachmentUrls = JSON.parse(existingAttachmentsJson)
      } catch {
        // If parsing fails, try to parse current motorcycle attachment
        if (currentMotorcycle.attachment) {
          try {
            const parsed = JSON.parse(currentMotorcycle.attachment)
            existingAttachmentUrls = Array.isArray(parsed) ? parsed : [currentMotorcycle.attachment]
          } catch {
            existingAttachmentUrls = [currentMotorcycle.attachment]
          }
        }
      }
    } else if (currentMotorcycle.attachment) {
      // If no existing attachments provided, try to parse current
      try {
        const parsed = JSON.parse(currentMotorcycle.attachment)
        existingAttachmentUrls = Array.isArray(parsed) ? parsed : [currentMotorcycle.attachment]
      } catch {
        existingAttachmentUrls = [currentMotorcycle.attachment]
      }
    }

    // Get old attachments for comparison
    let oldAttachments: string[] = []
    if (currentMotorcycle.attachment) {
      try {
        const parsed = JSON.parse(currentMotorcycle.attachment)
        oldAttachments = Array.isArray(parsed) ? parsed : [currentMotorcycle.attachment]
      } catch {
        oldAttachments = [currentMotorcycle.attachment]
      }
    }

    // Combine existing and new attachments
    const allAttachmentUrls = [...existingAttachmentUrls, ...newAttachmentUrls]
    const attachmentValue = allAttachmentUrls.length > 0 ? JSON.stringify(allAttachmentUrls) : null
    
    // Find attachments that were removed
    const removedAttachments = oldAttachments.filter(url => !existingAttachmentUrls.includes(url))
    
    // Delete removed attachment files
    for (const url of removedAttachments) {
      const attachmentPath = join(process.cwd(), 'public', url)
      if (existsSync(attachmentPath)) {
        try {
          await unlink(attachmentPath)
        } catch (err) {
          console.error('Error deleting attachment:', err)
        }
      }
    }

    // Get file names for activity logging
    const getFileName = (url: string) => {
      return url.split('/').pop() || url
    }

    // Prepare update data
    const updateData: any = {
      brand: brand.trim(),
      model: model.trim(),
      sku: sku.trim(),
      year: year ? parseInt(year) : null,
      engineSize: engineSize?.trim() || null,
      vin: vin?.trim() || null,
      color: color?.trim() || null,
      image: imageUrl,
      attachment: attachmentValue,
      usdRetailPrice: parseFloat(usdRetailPrice),
      usdWholesalePrice: parseFloat(usdWholesalePrice),
      rmbPrice: rmbPrice ? parseFloat(rmbPrice) : null,
      stockQuantity: parseInt(stockQuantity || '0'),
      lowStockThreshold: parseInt(lowStockThreshold || '10'),
      status: (status as any) || 'IN_STOCK',
      notes: notes?.trim() || null,
      updatedById: user.id,
    }

    // Get changes for activity logging
    const oldValues = {
      brand: currentMotorcycle.brand,
      model: currentMotorcycle.model,
      sku: currentMotorcycle.sku,
      usdRetailPrice: Number(currentMotorcycle.usdRetailPrice),
      usdWholesalePrice: Number(currentMotorcycle.usdWholesalePrice),
      rmbPrice: currentMotorcycle.rmbPrice ? Number(currentMotorcycle.rmbPrice) : null,
      stockQuantity: currentMotorcycle.stockQuantity,
      lowStockThreshold: currentMotorcycle.lowStockThreshold,
      notes: currentMotorcycle.notes,
    }
    const newValues = {
      brand: updateData.brand,
      model: updateData.model,
      sku: updateData.sku,
      usdRetailPrice: updateData.usdRetailPrice,
      usdWholesalePrice: updateData.usdWholesalePrice,
      rmbPrice: updateData.rmbPrice,
      stockQuantity: updateData.stockQuantity,
      lowStockThreshold: updateData.lowStockThreshold,
      notes: updateData.notes,
    }
    const changes = getChanges(oldValues, newValues)

    // Determine activity type based on changes
    let activityType: 'UPDATED' | 'STOCK_ADJUSTED' | 'PRICE_CHANGED' | 'IMAGE_CHANGED' = 'UPDATED'
    if (changes) {
      if (changes.stockQuantity) {
        const oldStock = oldValues.stockQuantity
        const newStock = newValues.stockQuantity
        if (newStock > oldStock) {
          activityType = 'STOCK_ADDED' as any
        } else if (newStock < oldStock) {
          activityType = 'STOCK_REDUCED' as any
        } else {
          activityType = 'STOCK_ADJUSTED'
        }
      } else if (changes.usdRetailPrice || changes.usdWholesalePrice || changes.rmbPrice) {
        activityType = 'PRICE_CHANGED'
      } else if (changes.image || imageFile) {
        activityType = 'IMAGE_CHANGED'
      }
    }

    // Update motorcycle
    const motorcycle = await prisma.motorcycle.update({
      where: { id },
      data: updateData,
    })

    const motorcycleName = `${motorcycle.brand} ${motorcycle.model}`

    // Log attachment activities separately
    if (newAttachmentUrls.length > 0) {
      const fileNames = newAttachmentUrls.map(getFileName).join(', ')
      await logActivity(
        'MOTORCYCLE',
        motorcycle.id,
        'ATTACHMENT_ADDED',
        user.id,
        `Attachment added to ${motorcycleName}: ${fileNames}`,
        {
          attachment: {
            old: oldAttachments.length,
            new: allAttachmentUrls.length
          },
          addedFiles: {
            old: '',
            new: fileNames
          }
        }
      )
    }

    if (removedAttachments.length > 0) {
      const removedFileNames = removedAttachments.map(getFileName).join(', ')
      await logActivity(
        'MOTORCYCLE',
        motorcycle.id,
        'ATTACHMENT_REMOVED',
        user.id,
        `Attachment removed from ${motorcycleName}: ${removedFileNames}`,
        {
          attachment: {
            old: oldAttachments.length,
            new: allAttachmentUrls.length
          },
          removedFiles: {
            old: removedFileNames,
            new: ''
          }
        }
      )
    }

    // Log other activity changes
    if (changes && Object.keys(changes).length > 0) {
      await logActivity(
        'MOTORCYCLE',
        motorcycle.id,
        activityType,
        user.id,
        createActivityDescription(activityType, motorcycleName, changes),
        changes
      )
    }

    return NextResponse.json({
      success: true,
      motorcycle,
    })
  } catch (error) {
    console.error('Error updating motorcycle:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to update motorcycle'
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

    // Get motorcycle to delete
    const motorcycle = await prisma.motorcycle.findUnique({
      where: { id },
    })

    if (!motorcycle) {
      return NextResponse.json(
        { error: 'Motorcycle not found' },
        { status: 404 }
      )
    }

    // Delete associated files
    if (motorcycle.image) {
      const imagePath = join(process.cwd(), 'public', motorcycle.image)
      if (existsSync(imagePath)) {
        try {
          await unlink(imagePath)
        } catch (err) {
          console.error('Error deleting image:', err)
        }
      }
    }

    // Delete all attachments (can be single string or JSON array)
    if (motorcycle.attachment) {
      let attachmentsToDelete: string[] = []
      try {
        const parsed = JSON.parse(motorcycle.attachment)
        attachmentsToDelete = Array.isArray(parsed) ? parsed : [motorcycle.attachment]
      } catch {
        attachmentsToDelete = [motorcycle.attachment]
      }
      
      for (const attachmentUrl of attachmentsToDelete) {
        const attachmentPath = join(process.cwd(), 'public', attachmentUrl)
        if (existsSync(attachmentPath)) {
          try {
            await unlink(attachmentPath)
          } catch (err) {
            console.error('Error deleting attachment:', err)
          }
        }
      }
    }

    // Delete motorcycle
    await prisma.motorcycle.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    console.error('Error deleting motorcycle:', error)
    return NextResponse.json(
      { error: 'Failed to delete motorcycle' },
      { status: 500 }
    )
  }
}

