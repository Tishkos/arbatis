import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

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

    // Check if MotorcycleCategory model exists in Prisma client
    if (!(prisma as any).motorcycleCategory) {
      console.warn('MotorcycleCategory model not available in Prisma client. Please run: npx prisma generate')
      return NextResponse.json({ categories: [] })
    }

    try {
      const categories = await (prisma as any).motorcycleCategory.findMany({
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          nameAr: true,
          nameKu: true,
        },
      })

      return NextResponse.json({ categories: categories || [] })
    } catch (dbError: any) {
      // If table doesn't exist or model is not available, return empty array
      if (dbError?.code === 'P2001' || dbError?.code === 'P2009' || 
          dbError?.message?.includes('motorcycleCategory') || 
          dbError?.message?.includes('Unknown field') ||
          dbError?.message?.includes('does not exist')) {
        console.warn('MotorcycleCategory table not available:', dbError.message)
        return NextResponse.json({ categories: [] })
      }
      throw dbError
    }
  } catch (error) {
    console.error('Error fetching motorcycle categories:', error)
    // Always return JSON, never HTML
    return NextResponse.json(
      { categories: [], error: 'Failed to fetch motorcycle categories' },
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

    // Check if MotorcycleCategory model exists
    if (!(prisma as any).motorcycleCategory) {
      console.warn('MotorcycleCategory model not available in Prisma client. Please run: npx prisma generate')
      return NextResponse.json(
        { error: 'Motorcycle categories are not available yet. Please run: npx prisma generate' },
        { status: 503 }
      )
    }

    let body
    try {
      body = await request.json()
    } catch (parseError) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    const { name, nameAr, nameKu, description, parentId } = body

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Category name is required' },
        { status: 400 }
      )
    }

    try {
      const category = await (prisma as any).motorcycleCategory.create({
        data: {
          name: name.trim(),
          nameAr: nameAr?.trim() || null,
          nameKu: nameKu?.trim() || null,
          description: description?.trim() || null,
          parentId: parentId || null,
        },
        select: {
          id: true,
          name: true,
          nameAr: true,
          nameKu: true,
        },
      })

      return NextResponse.json({ category })
    } catch (dbError: any) {
      // If table doesn't exist, return helpful error
      if (dbError?.code === 'P2001' || dbError?.code === 'P2009' || 
          dbError?.message?.includes('motorcycleCategory') || 
          dbError?.message?.includes('does not exist')) {
        console.warn('MotorcycleCategory table not available:', dbError.message)
        return NextResponse.json(
          { error: 'Motorcycle categories table does not exist. Please run: npx prisma migrate dev' },
          { status: 503 }
        )
      }
      throw dbError
    }
  } catch (error) {
    console.error('Error creating motorcycle category:', error)
    // Always return JSON, never HTML
    const errorMessage = error instanceof Error ? error.message : 'Failed to create motorcycle category'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

