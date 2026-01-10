import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        nameAr: true,
        nameKu: true,
      },
    })

    return NextResponse.json({ categories: categories || [] })
  } catch (error) {
    console.error('Error fetching categories:', error)
    return NextResponse.json(
      { categories: [], error: 'Failed to fetch categories' },
      { status: 500 }
    )
  }
}




