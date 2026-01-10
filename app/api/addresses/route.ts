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

    // Check if Address model exists in Prisma client (might not be available until Prisma client is regenerated)
    if (!prisma.address) {
      console.warn('Address model not available in Prisma client. Please run: npx prisma generate')
      return NextResponse.json({ addresses: [] })
    }

    const addresses = await prisma.address.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
      },
    })

    return NextResponse.json({ addresses })
  } catch (error) {
    console.error('Error fetching addresses:', error)
    // If Address model doesn't exist, return empty array instead of error
    if (error instanceof Error && error.message.includes('address')) {
      return NextResponse.json({ addresses: [] })
    }
    return NextResponse.json(
      { error: 'Failed to fetch addresses' },
      { status: 500 }
    )
  }
}

