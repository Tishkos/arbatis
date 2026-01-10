import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

/**
 * GET /api/activities
 * Fetch activities for a specific product or motorcycle
 * Query params: entityType (PRODUCT|MOTORCYCLE), entityId, page, pageSize
 */
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
    const entityType = searchParams.get('entityType') as 'PRODUCT' | 'MOTORCYCLE' | null
    const entityId = searchParams.get('entityId')
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '20'), 100)

    if (!entityType || !entityId) {
      return NextResponse.json(
        { error: 'entityType and entityId are required' },
        { status: 400 }
      )
    }

    const skip = (page - 1) * pageSize

    // Fetch activities
    const [activities, total] = await Promise.all([
      prisma.activity.findMany({
        where: {
          entityType,
          entityId,
        },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          invoice: {
            select: {
              id: true,
              invoiceNumber: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: pageSize,
      }),
      prisma.activity.count({
        where: {
          entityType,
          entityId,
        },
      }),
    ])

    // Format activities for response
    const formattedActivities = activities.map((activity) => ({
      id: activity.id,
      type: activity.type,
      description: activity.description,
      changes: activity.changes,
      invoiceId: activity.invoiceId,
      invoiceNumber: activity.invoice?.invoiceNumber || null,
      createdAt: activity.createdAt.toISOString(),
      createdBy: activity.createdBy ? {
        id: activity.createdBy.id,
        name: activity.createdBy.name,
        email: activity.createdBy.email,
      } : null,
    }))

    return NextResponse.json({
      activities: formattedActivities,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  } catch (error) {
    console.error('Error fetching activities:', error)
    return NextResponse.json(
      { error: 'Failed to fetch activities' },
      { status: 500 }
    )
  }
}

