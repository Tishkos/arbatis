import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import sharp from 'sharp'
import { logActivity, createActivityDescription, getChanges } from '@/lib/activity-logger'

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
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '20'), 100)
    const search = searchParams.get('search') || ''
    const categoryId = searchParams.get('categoryId') || undefined
    const minPrice = searchParams.get('minPrice') ? parseFloat(searchParams.get('minPrice')!) : undefined
    const maxPrice = searchParams.get('maxPrice') ? parseFloat(searchParams.get('maxPrice')!) : undefined
    const lowStock = searchParams.get('lowStock') === 'true'
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    const skip = (page - 1) * pageSize

    // Build where clause - only include non-empty conditions
    const conditions: Prisma.ProductWhereInput[] = []

    // Search filter
    if (search) {
      conditions.push({
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } },
          { barcode: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { notes: { contains: search, mode: 'insensitive' } },
        ],
      })
    }

    // Category filter
    if (categoryId) {
      conditions.push({ categoryId })
    }

    // Price filters
    if (minPrice !== undefined || maxPrice !== undefined) {
      const priceConditions: Prisma.ProductWhereInput[] = []
      
      if (minPrice !== undefined && maxPrice !== undefined) {
        priceConditions.push({
          OR: [
            { mufradPrice: { gte: minPrice, lte: maxPrice } },
            { jumlaPrice: { gte: minPrice, lte: maxPrice } },
            { rmbPrice: { gte: minPrice, lte: maxPrice } },
          ],
        })
      } else if (minPrice !== undefined) {
        priceConditions.push({
          OR: [
            { mufradPrice: { gte: minPrice } },
            { jumlaPrice: { gte: minPrice } },
            { rmbPrice: { gte: minPrice } },
          ],
        })
      } else if (maxPrice !== undefined) {
        priceConditions.push({
          OR: [
            { mufradPrice: { lte: maxPrice } },
            { jumlaPrice: { lte: maxPrice } },
            { rmbPrice: { lte: maxPrice } },
          ],
        })
      }
      
      if (priceConditions.length > 0) {
        conditions.push({ OR: priceConditions })
      }
    }

    // Low stock filter - handled in post-processing for now
    // Note: This is a simplified approach; full implementation would filter by product-specific thresholds
    if (lowStock) {
      conditions.push({
        stockQuantity: {
          lte: 10, // Default threshold
        },
      })
    }

    // Build final where clause
    const where: Prisma.ProductWhereInput = conditions.length > 0 
      ? { AND: conditions }
      : {}

    // Build orderBy
    const orderBy: Prisma.ProductOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    } as Prisma.ProductOrderByWithRelationInput

    // Get products and count
    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          category: {
            select: {
              id: true,
              name: true,
              nameAr: true,
              nameKu: true,
            },
          },
        },
        orderBy,
        skip,
        take: pageSize,
      }),
      prisma.product.count({ where }),
    ])

    return NextResponse.json({
      products: products || [],
      pagination: {
        page,
        pageSize,
        total: total || 0,
        totalPages: Math.ceil((total || 0) / pageSize),
      },
    })
  } catch (error) {
    console.error('Error fetching products:', error)
    // Return structure that matches expected response even on error
    return NextResponse.json({
      products: [],
      pagination: {
        page: 1,
        pageSize: 20,
        total: 0,
        totalPages: 0,
      },
      error: 'Failed to fetch products',
    }, { status: 500 })
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

    // Validate required fields
    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Product name is required' },
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
        const existingMotorcycle = await prisma.motorcycle.findUnique({
          where: { sku: generated },
        })
        
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
      // Check if user-provided SKU already exists
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
    let finalCategoryId: string | null = null

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
            } else if (categoryId) {
              finalCategoryId = categoryId
            }

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

    // Store attachments as JSON array
    const attachmentValue = attachmentUrls.length > 0 ? JSON.stringify(attachmentUrls) : null

    // Create product
    const product = await prisma.product.create({
      data: {
        name: name.trim(),
        sku: finalSku,
        mufradPrice: parseFloat(mufradPrice),
        jumlaPrice: parseFloat(jumlaPrice),
        rmbPrice: rmbPrice ? parseFloat(rmbPrice) : null,
        stockQuantity: parseInt(stockQuantity || '0'),
        lowStockThreshold: parseInt(lowStockThreshold || '10'),
        image: imageUrl,
        attachment: attachmentValue,
        notes: notes?.trim() || null,
        categoryId: finalCategoryId,
        purchasePrice: 0, // Default purchase price
        createdById: user.id,
      },
      include: {
        category: true,
      },
    })

    // Log creation activity
    await logActivity(
      'PRODUCT',
      product.id,
      'CREATED',
      user.id,
      createActivityDescription('CREATED', product.name),
      {
        name: { old: null, new: product.name },
        sku: { old: null, new: product.sku },
        stockQuantity: { old: null, new: product.stockQuantity },
        mufradPrice: { old: null, new: Number(product.mufradPrice) },
        jumlaPrice: { old: null, new: Number(product.jumlaPrice) },
      }
    )

    return NextResponse.json({
      success: true,
      product,
    })
  } catch (error) {
    console.error('Error creating product:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to create product'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
