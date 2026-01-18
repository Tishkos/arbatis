import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { writeFile, mkdir, unlink } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { logActivity, createActivityDescription, getChanges } from '@/lib/activity-logger'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    let session
    try {
      session = await getServerSession(authOptions)
    } catch (authError) {
      console.error('Error getting session:', authError)
      return NextResponse.json(
        { error: 'Authentication error' },
        { status: 401 }
      )
    }

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = await params

    // Try to fetch with new schema first, fallback to old schema if needed
    let motorcycle
    try {
      motorcycle = await prisma.motorcycle.findUnique({
        where: { id },
        include: {
          category: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      })
    } catch (schemaError: any) {
      // If category relation doesn't exist, fetch without it
      if (schemaError?.code === 'P2019' || schemaError?.message?.includes('category')) {
        motorcycle = await prisma.motorcycle.findUnique({
          where: { id },
        })
        // Transform old schema to new schema format for frontend
        if (motorcycle) {
          motorcycle = {
            ...motorcycle,
            name: (motorcycle as any).name || `${(motorcycle as any).brand || ''} ${(motorcycle as any).model || ''}`.trim() || 'Motorcycle',
            category: null,
            categoryId: null,
          } as any
        }
      } else {
        throw schemaError
      }
    }

    if (!motorcycle) {
      return NextResponse.json(
        { error: 'Motorcycle not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ motorcycle })
  } catch (error) {
    console.error('Error fetching motorcycle:', error)
    // Always return JSON, never HTML
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch motorcycle'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    let session
    try {
      session = await getServerSession(authOptions)
    } catch (authError) {
      console.error('Error getting session:', authError)
      return NextResponse.json(
        { error: 'Authentication error' },
        { status: 401 }
      )
    }

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
    const categoryId = formData.get('categoryId') as string | null
    const newCategoryName = formData.get('newCategoryName') as string | null
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
    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      )
    }
    if (!sku || !sku.trim()) {
      return NextResponse.json(
        { error: 'SKU is required' },
        { status: 400 }
      )
    }
    
    const finalSku = sku.trim()
    
    // Validate SKU format: must be exactly 6 alphanumeric characters (A-Z, 0-9)
    if (!/^[A-Z0-9]{6}$/.test(finalSku)) {
      return NextResponse.json(
        { error: 'SKU must be exactly 6 alphanumeric characters (letters A-Z and numbers 0-9)' },
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

    // Check if SKU already exists in products or motorcycles (excluding current motorcycle)
    if (finalSku !== currentMotorcycle.sku) {
      const existingProduct = await prisma.product.findUnique({
        where: { sku: finalSku },
      })
      const existingMotorcycle = await prisma.motorcycle.findUnique({
        where: { sku: finalSku },
      })

      if (existingProduct || existingMotorcycle) {
        return NextResponse.json(
          { error: 'SKU already exists in products or motorcycles' },
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

      // Compress image using Sharp (dynamic import to avoid loading for GET requests)
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
        // If sharp fails to load (e.g., Windows Application Control policy), use original buffer
        console.warn('Sharp module failed to load, using original image:', sharpError)
        compressedBuffer = buffer
      }

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

      const sanitizedSku = finalSku
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

      const sanitizedSku = finalSku
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

    // Handle motorcycle category creation or selection
    let finalCategoryId: string | null = null
    try {
      // Check if MotorcycleCategory model exists in Prisma client
      if (prisma.motorcycleCategory && newCategoryName && newCategoryName.trim()) {
        const existingCategory = await prisma.motorcycleCategory.findFirst({
          where: {
            name: {
              equals: newCategoryName.trim(),
              mode: 'insensitive',
            },
          },
        })

        if (existingCategory) {
          finalCategoryId = existingCategory.id
        } else {
          const newCategory = await prisma.motorcycleCategory.create({
            data: {
              name: newCategoryName.trim(),
            },
          })
          finalCategoryId = newCategory.id
        }
      } else if (categoryId && categoryId !== 'none' && prisma.motorcycleCategory) {
        finalCategoryId = categoryId
      }
    } catch (error: any) {
      // If MotorcycleCategory table doesn't exist yet, just skip category
      if (error?.code === 'P2001' || error?.code === 'P2009' || 
          error?.message?.includes('motorcycleCategory') || 
          error?.message?.includes('Unknown field') ||
          error?.message?.includes('Cannot read properties of undefined')) {
        finalCategoryId = null
      } else {
        throw error
      }
    }

    // Prepare update data - try new schema first
    let updateData: any
    try {
      updateData = {
        name: name.trim(),
        sku: finalSku,
        image: imageUrl,
        attachment: attachmentValue,
        usdRetailPrice: parseFloat(usdRetailPrice),
        usdWholesalePrice: parseFloat(usdWholesalePrice),
        rmbPrice: rmbPrice ? parseFloat(rmbPrice) : null,
        stockQuantity: parseInt(stockQuantity || '0'),
        lowStockThreshold: parseInt(lowStockThreshold || '10'),
        status: (status as any) || 'IN_STOCK',
        notes: notes?.trim() || null,
        categoryId: finalCategoryId,
        updatedById: user.id,
      }
    } catch {
      // Fallback if schema doesn't support new fields
      updateData = {
        name: name.trim(),
        sku: finalSku,
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
    }

    // Get changes for activity logging
    const oldValues: any = {
      name: (currentMotorcycle as any).name || (currentMotorcycle as any).brand || '',
      sku: currentMotorcycle.sku,
      usdRetailPrice: Number(currentMotorcycle.usdRetailPrice),
      usdWholesalePrice: Number(currentMotorcycle.usdWholesalePrice),
      rmbPrice: currentMotorcycle.rmbPrice ? Number(currentMotorcycle.rmbPrice) : null,
      stockQuantity: currentMotorcycle.stockQuantity,
      lowStockThreshold: currentMotorcycle.lowStockThreshold,
      notes: currentMotorcycle.notes,
    }
    const newValues = {
      name: updateData.name,
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
    let motorcycle = await prisma.motorcycle.update({
      where: { id },
      data: updateData,
    })

    // Transform old schema response to include name field for frontend
    if (!(motorcycle as any).name && ((motorcycle as any).brand || (motorcycle as any).model)) {
      motorcycle = {
        ...motorcycle,
        name: name.trim(),
        category: null,
        categoryId: null,
      } as any
    }

    const motorcycleName = (motorcycle as any).name || `${(motorcycle as any).brand || ''} ${(motorcycle as any).model || ''}`.trim() || 'Motorcycle'

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
    let session
    try {
      session = await getServerSession(authOptions)
    } catch (authError) {
      console.error('Error getting session:', authError)
      return NextResponse.json(
        { error: 'Authentication error' },
        { status: 401 }
      )
    }

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

