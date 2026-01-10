import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { writeFile, mkdir, unlink } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import { logActivity, createActivityDescription, getChanges } from '@/lib/activity-logger'

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
    const mufradPrice = formData.get('mufradPrice') as string
    const jumlaPrice = formData.get('jumlaPrice') as string
    const rmbPrice = formData.get('rmbPrice') as string | null
    const stockQuantity = formData.get('stockQuantity') as string
    const lowStockThreshold = formData.get('lowStockThreshold') as string
    const categoryId = formData.get('categoryId') as string | null
    const newCategoryName = formData.get('newCategoryName') as string | null
    const imageFile = formData.get('image') as File | null
    const notes = formData.get('notes') as string | null
    const attachmentFiles = formData.getAll('attachments') as File[]
    const existingAttachmentsJson = formData.get('existingAttachments') as string | null

    // Validate required fields
    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Product name is required' },
        { status: 400 }
      )
    }
    if (!sku || !sku.trim()) {
      return NextResponse.json(
        { error: 'SKU is required' },
        { status: 400 }
      )
    }
    if (!mufradPrice || parseFloat(mufradPrice) <= 0) {
      return NextResponse.json(
        { error: 'Retail price must be greater than 0' },
        { status: 400 }
      )
    }
    if (!jumlaPrice || parseFloat(jumlaPrice) <= 0) {
      return NextResponse.json(
        { error: 'Wholesale price must be greater than 0' },
        { status: 400 }
      )
    }

    // Get current product
    const currentProduct = await prisma.product.findUnique({
      where: { id },
    })

    if (!currentProduct) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    // Check if SKU already exists for another product
    if (sku.trim() !== currentProduct.sku) {
      const existingProduct = await prisma.product.findUnique({
        where: { sku: sku.trim() },
      })

      if (existingProduct) {
        return NextResponse.json(
          { error: 'SKU already exists' },
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

    let imageUrl: string | null = currentProduct.image
    let finalCategoryId: string | null = categoryId || currentProduct.categoryId
    
    // Parse existing attachments
    let existingAttachmentUrls: string[] = []
    if (existingAttachmentsJson) {
      try {
        existingAttachmentUrls = JSON.parse(existingAttachmentsJson)
      } catch {
        // If parsing fails, try to parse current product attachment
        if (currentProduct.attachment) {
          try {
            const parsed = JSON.parse(currentProduct.attachment)
            existingAttachmentUrls = Array.isArray(parsed) ? parsed : [currentProduct.attachment]
          } catch {
            existingAttachmentUrls = [currentProduct.attachment]
          }
        }
      }
    } else if (currentProduct.attachment) {
      // If no existing attachments provided, try to parse current
      try {
        const parsed = JSON.parse(currentProduct.attachment)
        existingAttachmentUrls = Array.isArray(parsed) ? parsed : [currentProduct.attachment]
      } catch {
        existingAttachmentUrls = [currentProduct.attachment]
      }
    }

    // Handle category creation or selection
    if (newCategoryName && newCategoryName.trim()) {
      // Check if category already exists (case-insensitive)
      const existingCategory = await prisma.category.findFirst({
        where: {
          name: {
            equals: newCategoryName.trim(),
            mode: 'insensitive',
          },
        },
      })

      if (existingCategory) {
        // Use existing category instead of creating duplicate
        finalCategoryId = existingCategory.id
      } else {
        // Create new category only if it doesn't exist
        const newCategory = await prisma.category.create({
          data: {
            name: newCategoryName.trim(),
          },
        })
        finalCategoryId = newCategory.id
      }
    }

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
      const sharp = (await import('sharp')).default
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
      if (currentProduct.image) {
        const oldImagePath = join(process.cwd(), 'public', currentProduct.image)
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

    // Get old attachments for comparison
    let oldAttachments: string[] = []
    if (currentProduct.attachment) {
      try {
        const parsed = JSON.parse(currentProduct.attachment)
        oldAttachments = Array.isArray(parsed) ? parsed : [currentProduct.attachment]
      } catch {
        oldAttachments = [currentProduct.attachment]
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
      name: name.trim(),
      sku: sku.trim(),
      mufradPrice: parseFloat(mufradPrice),
      jumlaPrice: parseFloat(jumlaPrice),
      rmbPrice: rmbPrice ? parseFloat(rmbPrice) : null,
      stockQuantity: parseInt(stockQuantity || '0'),
      lowStockThreshold: parseInt(lowStockThreshold || '10'),
      image: imageUrl,
      attachment: attachmentValue,
      notes: notes?.trim() || null,
      categoryId: finalCategoryId,
      updatedById: user.id,
    }

    // Get changes for activity logging
    const oldValues = {
      name: currentProduct.name,
      sku: currentProduct.sku,
      mufradPrice: Number(currentProduct.mufradPrice),
      jumlaPrice: Number(currentProduct.jumlaPrice),
      rmbPrice: currentProduct.rmbPrice ? Number(currentProduct.rmbPrice) : null,
      stockQuantity: currentProduct.stockQuantity,
      lowStockThreshold: currentProduct.lowStockThreshold,
      categoryId: currentProduct.categoryId,
      notes: currentProduct.notes,
    }
    const newValues = {
      name: updateData.name,
      sku: updateData.sku,
      mufradPrice: updateData.mufradPrice,
      jumlaPrice: updateData.jumlaPrice,
      rmbPrice: updateData.rmbPrice,
      stockQuantity: updateData.stockQuantity,
      lowStockThreshold: updateData.lowStockThreshold,
      categoryId: updateData.categoryId,
      notes: updateData.notes,
    }
    const changes = getChanges(oldValues, newValues)

    // Determine activity type based on changes
    let activityType: 'UPDATED' | 'STOCK_ADJUSTED' | 'PRICE_CHANGED' | 'IMAGE_CHANGED' | 'CATEGORY_CHANGED' = 'UPDATED'
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
      } else if (changes.mufradPrice || changes.jumlaPrice || changes.rmbPrice) {
        activityType = 'PRICE_CHANGED'
      } else if (changes.image || imageFile) {
        activityType = 'IMAGE_CHANGED'
      } else if (changes.categoryId) {
        activityType = 'CATEGORY_CHANGED'
      }
    }

    // Update product
    const product = await prisma.product.update({
      where: { id },
      data: updateData,
      include: {
        category: true,
      },
    })

    // Log attachment activities separately
    if (newAttachmentUrls.length > 0) {
      const fileNames = newAttachmentUrls.map(getFileName).join(', ')
      await logActivity(
        'PRODUCT',
        product.id,
        'ATTACHMENT_ADDED',
        user.id,
        `Attachment added to ${product.name}: ${fileNames}`,
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
        'PRODUCT',
        product.id,
        'ATTACHMENT_REMOVED',
        user.id,
        `Attachment removed from ${product.name}: ${removedFileNames}`,
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
        'PRODUCT',
        product.id,
        activityType,
        user.id,
        createActivityDescription(activityType, product.name, changes),
        changes
      )
    }

    return NextResponse.json({
      success: true,
      product,
    })
  } catch (error) {
    console.error('Error updating product:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to update product'
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

    // Get product to delete
    const product = await prisma.product.findUnique({
      where: { id },
    })

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    // Delete associated files
    if (product.image) {
      const imagePath = join(process.cwd(), 'public', product.image)
      if (existsSync(imagePath)) {
        try {
          await unlink(imagePath)
        } catch (err) {
          console.error('Error deleting image:', err)
        }
      }
    }

    // Delete all attachments (can be single string or JSON array)
    if (product.attachment) {
      let attachmentsToDelete: string[] = []
      try {
        const parsed = JSON.parse(product.attachment)
        attachmentsToDelete = Array.isArray(parsed) ? parsed : [product.attachment]
      } catch {
        attachmentsToDelete = [product.attachment]
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

    // Delete product
    await prisma.product.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
      message: 'Product deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting product:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete product'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

