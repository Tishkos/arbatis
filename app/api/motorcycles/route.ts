import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import sharp from 'sharp'
import { logActivity, createActivityDescription, getChanges } from '@/lib/activity-logger'

export async function GET(request: NextRequest) {
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

    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '20')
    const search = searchParams.get('search') || ''
    const categoryId = searchParams.get('categoryId') || ''
    const lowStock = searchParams.get('lowStock') === 'true'
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    const skip = (page - 1) * pageSize

    // Try new schema first, fallback to old schema if migration hasn't run
    let motorcycles: any[] = []
    let where: any
    let orderBy: any = {}
    let useOldSchema = false
    orderBy[sortBy] = sortOrder

    // Map new schema field names to old schema if needed
    const fieldMapping: Record<string, string> = {
      'name': 'brand', // Fallback to brand for old schema
    }

    try {
      // Build where clause for NEW schema (with name and categoryId)
      where = {
        status: 'IN_STOCK'
      }
      
      if (categoryId) {
        where.categoryId = categoryId
      }
      
      if (search) {
        where.AND = [
          { status: 'IN_STOCK' },
          ...(categoryId ? [{ categoryId }] : []),
          {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { sku: { contains: search, mode: 'insensitive' } },
            ]
          }
        ]
        delete where.status
        if (categoryId) delete where.categoryId
      } else if (categoryId) {
        where.categoryId = categoryId
      }

      // Try to fetch with new schema (including category)
      motorcycles = await (prisma.motorcycle.findMany as any)({
        where,
        skip: lowStock ? 0 : skip,
        take: lowStock ? undefined : pageSize,
        orderBy,
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
      // If new schema fields don't exist, use old schema
      if (schemaError?.code === 'P2009' || schemaError?.message?.includes('Unknown field') || 
          schemaError?.message?.includes('name') || schemaError?.message?.includes('categoryId') ||
          schemaError?.message?.includes('Unknown arg')) {
        
        useOldSchema = true
        
        // Build where clause for OLD schema (with brand/model, no categoryId)
        where = {
          status: 'IN_STOCK'
        }
        
        if (search) {
          where.AND = [
            { status: 'IN_STOCK' },
            {
              OR: [
                { brand: { contains: search, mode: 'insensitive' } },
                { model: { contains: search, mode: 'insensitive' } },
                { sku: { contains: search, mode: 'insensitive' } },
                { color: { contains: search, mode: 'insensitive' } },
              ]
            }
          ]
          delete where.status
        }

        // Build orderBy for old schema - map 'name' to 'brand' if needed
        const oldOrderBy: any = {}
        const oldSortBy = fieldMapping[sortBy] || sortBy
        // Make sure the field exists in old schema
        if (oldSortBy === 'name') {
          oldOrderBy['brand'] = sortOrder
        } else {
          oldOrderBy[oldSortBy] = sortOrder
        }

        // Fetch with old schema (no category)
        motorcycles = await prisma.motorcycle.findMany({
          where,
          skip: lowStock ? 0 : skip,
          take: lowStock ? undefined : pageSize,
          orderBy: oldOrderBy,
        })
        
        // Transform old schema to new schema format for frontend
        motorcycles = motorcycles.map((m: any) => ({
          ...m,
          name: m.name || `${m.brand || ''} ${m.model || ''}`.trim() || 'Motorcycle',
          category: null,
          categoryId: null,
        }))
      } else {
        throw schemaError
      }
    }

    // Filter for low stock items (stockQuantity <= lowStockThreshold)
    if (lowStock) {
      motorcycles = motorcycles.filter(
        (m: any) => m.stockQuantity <= m.lowStockThreshold
      )
      // Apply pagination after filtering
      const total = motorcycles.length
      motorcycles = motorcycles.slice(skip, skip + pageSize)
      return NextResponse.json({
        motorcycles,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      })
    }

    // Get total count (for non-low-stock filter) - use same schema as fetch
    let total
    try {
      if (useOldSchema) {
        // For old schema, ensure where clause doesn't have new schema fields
        const countWhere: any = { status: 'IN_STOCK' }
        if (search) {
          countWhere.AND = [
            { status: 'IN_STOCK' },
            {
              OR: [
                { brand: { contains: search, mode: 'insensitive' } },
                { model: { contains: search, mode: 'insensitive' } },
                { sku: { contains: search, mode: 'insensitive' } },
                { color: { contains: search, mode: 'insensitive' } },
              ]
            }
          ]
          delete countWhere.status
        }
        total = await prisma.motorcycle.count({ where: countWhere })
      } else {
        total = await prisma.motorcycle.count({ where })
      }
    } catch (countError: any) {
      // If count fails with new schema, try old schema
      if (!useOldSchema && (countError?.code === 'P2009' || countError?.message?.includes('Unknown field') || 
          countError?.message?.includes('name') || countError?.message?.includes('categoryId'))) {
        const countWhere: any = { status: 'IN_STOCK' }
        if (search) {
          countWhere.AND = [
            { status: 'IN_STOCK' },
            {
              OR: [
                { brand: { contains: search, mode: 'insensitive' } },
                { model: { contains: search, mode: 'insensitive' } },
                { sku: { contains: search, mode: 'insensitive' } },
                { color: { contains: search, mode: 'insensitive' } },
              ]
            }
          ]
          delete countWhere.status
        }
        total = await prisma.motorcycle.count({ where: countWhere })
      } else {
        throw countError
      }
    }

    // Ensure motorcycles is always an array
    if (!Array.isArray(motorcycles)) {
      motorcycles = []
    }

    return NextResponse.json({
      motorcycles: motorcycles || [],
      pagination: {
        page,
        pageSize,
        total: total || 0,
        totalPages: Math.ceil((total || 0) / pageSize),
      },
    })
  } catch (error: any) {
    console.error('Error fetching motorcycles:', error)
    console.error('Error stack:', error?.stack)
    console.error('Error code:', error?.code)
    console.error('Error message:', error?.message)
    
    // Provide more helpful error message if schema mismatch
    if (error?.code === 'P2009' || error?.message?.includes('Unknown field') || error?.message?.includes('name') || error?.message?.includes('categoryId') || error?.message?.includes('Unknown arg')) {
      return NextResponse.json(
        { 
          error: 'Database schema needs to be migrated. Please run: npx prisma migrate dev',
          details: error.message 
        },
        { status: 500 }
      )
    }
    
    // Always return JSON - never throw or return HTML
    const errorMessage = error?.message || 'Unknown error'
    const errorDetails = {
      error: 'Failed to fetch motorcycles',
      details: errorMessage,
      code: error?.code,
    }
    
    return NextResponse.json(
      errorDetails,
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
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
    // Generate SKU if not provided, or check uniqueness if provided
    let finalSku = sku?.trim() || ''
    
    if (!finalSku) {
      // Generate random 6-character alphanumeric code
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
      let generated = ''
      
      // Ensure uniqueness - try up to 10 times
      for (let attempt = 0; attempt < 10; attempt++) {
        generated = ''
        for (let i = 0; i < 6; i++) {
          generated += chars.charAt(Math.floor(Math.random() * chars.length))
        }
        
        const existingProduct = await prisma.product.findUnique({
          where: { sku: generated },
        })
        // Check motorcycle SKU - handle both schema versions
        let existingMotorcycle = null
        try {
          existingMotorcycle = await prisma.motorcycle.findUnique({
            where: { sku: generated },
          })
        } catch (e: any) {
          // If findUnique fails, try findFirst (works even if schema mismatch)
          try {
            existingMotorcycle = await (prisma.motorcycle.findFirst as any)({
              where: { sku: generated },
            })
          } catch {
            // If both fail, assume no match
            existingMotorcycle = null
          }
        }
        
        if (!existingProduct && !existingMotorcycle) {
          finalSku = generated
          break
        }
      }
      
      // If still no unique SKU after 10 attempts, return error
      if (!finalSku) {
        return NextResponse.json(
          { error: 'Failed to generate unique SKU. Please try again.' },
          { status: 500 }
        )
      }
    } else {
      // Validate user-provided SKU format: must be exactly 6 alphanumeric characters (A-Z, 0-9)
      if (!/^[A-Z0-9]{6}$/.test(finalSku)) {
        return NextResponse.json(
          { error: 'SKU must be exactly 6 alphanumeric characters (letters A-Z and numbers 0-9)' },
          { status: 400 }
        )
      }
      
      // Check if user-provided SKU already exists
      const existingProduct = await prisma.product.findUnique({
        where: { sku: finalSku },
      })
      // Check motorcycle SKU - handle both schema versions
      let existingMotorcycle = null
      try {
        existingMotorcycle = await prisma.motorcycle.findUnique({
          where: { sku: finalSku },
        })
      } catch (e: any) {
        // If findUnique fails, try findFirst (works even if schema mismatch)
        try {
          existingMotorcycle = await (prisma.motorcycle.findFirst as any)({
            where: { sku: finalSku },
          })
        } catch {
          // If both fail, assume no match
          existingMotorcycle = null
        }
      }

      if (existingProduct || existingMotorcycle) {
        return NextResponse.json(
          { error: 'SKU already exists in products or motorcycles' },
          { status: 400 }
        )
      }
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

      // Create products directory if it doesn't exist
      const productsDir = join(process.cwd(), 'public', 'products')
      if (!existsSync(productsDir)) {
        await mkdir(productsDir, { recursive: true })
      }

      // Generate filename based on SKU (sanitized)
      const sanitizedSku = finalSku
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
      
      const fileName = `${sanitizedSku}.jpg`
      const filePath = join(productsDir, fileName)

      // Save compressed file
      await writeFile(filePath, compressedBuffer)

      // Generate URL
      imageUrl = `/products/${fileName}`
    }

    // Handle multiple attachment uploads
    const attachmentUrls: string[] = []
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
        attachmentUrls.push(`/attachments/${fileName}`)
      }
    }

    // Parse existing attachments
    let existingAttachmentUrls: string[] = []
    if (existingAttachmentsJson) {
      try {
        existingAttachmentUrls = JSON.parse(existingAttachmentsJson)
      } catch {
        // Ignore parse errors
      }
    }

    // Combine existing and new attachments
    const allAttachmentUrls = [...existingAttachmentUrls, ...attachmentUrls]
    const attachmentValue = allAttachmentUrls.length > 0 ? JSON.stringify(allAttachmentUrls) : null

    // Handle motorcycle category creation or selection
    let finalCategoryId: string | null = null
    
    // Only process categories if newCategoryName or categoryId is provided
    if (newCategoryName && newCategoryName.trim()) {
      try {
        // Check if MotorcycleCategory model exists in Prisma client
        const motorcycleCategoryModel = (prisma as any).motorcycleCategory
        if (!motorcycleCategoryModel) {
          console.warn('MotorcycleCategory model not found in Prisma client. Run: npx prisma generate')
          finalCategoryId = null
        } else {
          // Check if category already exists (case-insensitive)
          const existingCategory = await motorcycleCategoryModel.findFirst({
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
            const newCategory = await motorcycleCategoryModel.create({
              data: {
                name: newCategoryName.trim(),
              },
            })
            finalCategoryId = newCategory.id
          }
        }
      } catch (error: any) {
        // If MotorcycleCategory table doesn't exist yet, just skip category
        if (error?.code === 'P2001' || error?.code === 'P2009' || 
            error?.message?.includes('motorcycleCategory') || 
            error?.message?.includes('Unknown field') ||
            error?.message?.includes('Cannot read properties of undefined') ||
            error?.message?.includes('findFirst') ||
            error?.message?.includes('create')) {
          finalCategoryId = null
          console.warn('MotorcycleCategory model not available, skipping category creation:', error.message)
        } else {
          // Re-throw unexpected errors
          console.error('Unexpected error creating motorcycle category:', error)
          throw error
        }
      }
    } else if (categoryId && categoryId !== 'none') {
      try {
        // Just use the provided categoryId if MotorcycleCategory model exists
        const motorcycleCategoryModel = (prisma as any).motorcycleCategory
        if (motorcycleCategoryModel) {
          finalCategoryId = categoryId
        }
      } catch (error: any) {
        // If MotorcycleCategory model doesn't exist, skip
        finalCategoryId = null
      }
    }

    // Try to create with new schema first, fallback to old schema if needed
    let motorcycle
    try {
      // Try new schema (with name and categoryId)
      motorcycle = await (prisma.motorcycle.create as any)({
        data: {
          name: name.trim(),
          sku: finalSku,
          categoryId: finalCategoryId,
          image: imageUrl,
          attachment: attachmentValue,
          usdRetailPrice: parseFloat(usdRetailPrice),
          usdWholesalePrice: parseFloat(usdWholesalePrice),
          rmbPrice: rmbPrice ? parseFloat(rmbPrice) : null,
          stockQuantity: parseInt(stockQuantity || '0'),
          lowStockThreshold: parseInt(lowStockThreshold || '10'),
          status: (status as any) || 'IN_STOCK',
          notes: notes?.trim() || null,
          createdById: user.id,
        },
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
      const errorMessage = schemaError?.message || ''
      
      // Check if error is specifically about 'brand' column not existing - this means DB is on new schema
      // and we should NOT fall back to old schema
      if (errorMessage.includes('brand') && errorMessage.includes('does not exist')) {
        // Database is on new schema but something else failed - don't fall back, throw the error
        throw schemaError
      }
      
      // Check if error is specifically about 'name' field not existing (old schema detection)
      const isOldSchemaError = 
        (schemaError?.code === 'P2009' && errorMessage.includes('name') && !errorMessage.includes('brand')) ||
        (errorMessage.includes('Unknown field') && errorMessage.includes('name') && !errorMessage.includes('brand')) ||
        (errorMessage.includes('column') && errorMessage.includes('name') && errorMessage.includes('does not exist') && !errorMessage.includes('brand'))
      
      // If error might be due to categoryId foreign key issue, try without categoryId first
      if (!isOldSchemaError && (errorMessage.includes('categoryId') || errorMessage.includes('Foreign key') || errorMessage.includes('foreign key constraint'))) {
        try {
          // Retry with new schema but without categoryId
          motorcycle = await (prisma.motorcycle.create as any)({
            data: {
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
              createdById: user.id,
              // Don't include categoryId if it was causing issues
            },
            include: {
              category: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          })
        } catch (retryError: any) {
          // If retry also fails and error mentions 'name' field, might be old schema
          if (retryError?.message?.includes('name') && !retryError?.message?.includes('brand')) {
            // Might be old schema, fall through to old schema fallback
          } else {
            throw retryError
          }
        }
      }
      
      // Only fall back to old schema if we detected it's actually an old schema error
      if (isOldSchemaError && !motorcycle) {
        // Fallback to old schema - split name into brand/model
        const nameParts = name.trim().split(' ')
        const brand = nameParts[0] || name.trim()
        const model = nameParts.slice(1).join(' ') || ''
        
        try {
          motorcycle = await (prisma.motorcycle.create as any)({
            data: {
              brand: brand,
              model: model,
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
              createdById: user.id,
            },
          })
          
          // Transform old schema response to include name field for frontend
          motorcycle = {
            ...motorcycle,
            name: name.trim(),
            category: null,
            categoryId: null,
          } as any
        } catch (fallbackError: any) {
          // If fallback fails with 'brand' doesn't exist, we know DB is on new schema
          // This should not happen if error detection is correct, but handle it anyway
          if (fallbackError?.message?.includes('brand') || 
              (fallbackError?.message?.includes('does not exist') && fallbackError?.message?.includes('brand'))) {
            throw new Error('Database schema mismatch: Database uses new schema (name field) but code attempted to use old schema (brand/model). Please check your database migration status.')
          } else {
            throw fallbackError
          }
        }
      } else if (!motorcycle) {
        // If we didn't handle the error and motorcycle is still not created, throw original error
        throw schemaError
      }
    }

    // Log creation activity
    const motorcycleName = (motorcycle as any).name || `${(motorcycle as any).brand || ''} ${(motorcycle as any).model || ''}`.trim() || 'Motorcycle'
    await logActivity(
      'MOTORCYCLE',
      motorcycle.id,
      'CREATED',
      user.id,
      createActivityDescription('CREATED', motorcycleName),
      {
        name: { old: null, new: motorcycleName },
        sku: { old: null, new: motorcycle.sku },
        stockQuantity: { old: null, new: motorcycle.stockQuantity },
        usdRetailPrice: { old: null, new: Number(motorcycle.usdRetailPrice) },
        usdWholesalePrice: { old: null, new: Number(motorcycle.usdWholesalePrice) },
      }
    )

    return NextResponse.json({
      success: true,
      motorcycle,
    })
  } catch (error) {
    console.error('Error creating motorcycle:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to create motorcycle'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

