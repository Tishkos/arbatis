import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

/**
 * GET /api/activities/all
 * Fetch all activities with filters
 * Query params: page, pageSize, search, userId, entityType, activityType
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
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '20'), 100)
    const search = searchParams.get('search') || ''
    const userId = searchParams.get('userId') || ''
    const entityType = searchParams.get('entityType') as 'PRODUCT' | 'MOTORCYCLE' | 'INVOICE' | 'invoices' | 'invoice' | '' | null
    const activityType = searchParams.get('activityType') || ''

    const skip = (page - 1) * pageSize

    // Build where clause
    const where: any = {}

    // Filter by user
    if (userId) {
      where.createdById = userId
    }

    // Filter by entity type or invoice-related
    if (entityType) {
      if (entityType === 'invoice' || entityType === 'invoices' || entityType === 'INVOICE') {
        // Filter for activities that have an invoiceId (invoice/sale related)
        where.invoiceId = { not: null }
      } else {
        // Filter by entity type (PRODUCT or MOTORCYCLE)
        where.entityType = entityType
      }
    }

    // Filter by activity type
    if (activityType) {
      where.type = activityType
    }

    // Search filter (description or invoice number)
    if (search) {
      where.OR = [
        { description: { contains: search, mode: 'insensitive' } },
        { invoice: { invoiceNumber: { contains: search, mode: 'insensitive' } } },
      ]
    }

    // Fetch activities
    const [activities, total] = await Promise.all([
      prisma.activity.findMany({
        where,
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
      prisma.activity.count({ where }),
    ])

    // Format activities for response
    const formattedActivities = activities.map((activity) => ({
      id: activity.id,
      entityType: activity.entityType,
      entityId: activity.entityId,
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

