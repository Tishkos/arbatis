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
    const lowStock = searchParams.get('lowStock') === 'true'
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    const skip = (page - 1) * pageSize

    // Build where clause - only show IN_STOCK motorcycles
    const where: any = {
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

    // Build orderBy
    const orderBy: any = {}
    orderBy[sortBy] = sortOrder

    // Get motorcycles (fetch all if filtering low stock, then filter in code)
    let motorcycles = await prisma.motorcycle.findMany({
      where,
      skip: lowStock ? 0 : skip, // Fetch all if filtering low stock
      take: lowStock ? undefined : pageSize,
      orderBy,
    })

    // Filter for low stock items (stockQuantity <= lowStockThreshold)
    if (lowStock) {
      motorcycles = motorcycles.filter(
        (m) => m.stockQuantity <= m.lowStockThreshold
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

    // Get total count (for non-low-stock filter)
    const total = await prisma.motorcycle.count({ where })

    return NextResponse.json({
      motorcycles,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  } catch (error) {
    console.error('Error fetching motorcycles:', error)
    return NextResponse.json(
      { error: 'Failed to fetch motorcycles' },
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

    // Create motorcycle
    const motorcycle = await prisma.motorcycle.create({
      data: {
        brand: brand.trim(),
        model: model.trim(),
        sku: finalSku,
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
        createdById: user.id,
      },
    })

    // Log creation activity
    const motorcycleName = `${motorcycle.brand} ${motorcycle.model}`
    await logActivity(
      'MOTORCYCLE',
      motorcycle.id,
      'CREATED',
      user.id,
      createActivityDescription('CREATED', motorcycleName),
      {
        brand: { old: null, new: motorcycle.brand },
        model: { old: null, new: motorcycle.model },
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

