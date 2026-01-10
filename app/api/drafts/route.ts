import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { DraftService } from '@/modules/drafts/services'

const draftService = new DraftService()

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const {
      type,
      customerId,
      items = [],
      discount = 0,
      notes,
    } = body

    // Validate customerId for wholesale (JUMLA) type
    const validCustomerId = customerId && typeof customerId === 'string' && customerId.trim() !== '' ? customerId.trim() : undefined
    
    if (type === 'JUMLA' && !validCustomerId) {
      return NextResponse.json(
        { error: 'Customer is required for wholesale (JUMLA) sales' },
        { status: 400 }
      )
    }

    // If customerId is provided, verify it exists
    if (validCustomerId) {
      const customer = await prisma.customer.findUnique({
        where: { id: validCustomerId },
      })
      
      if (!customer) {
        return NextResponse.json(
          { error: 'Invalid customer ID. Customer not found.' },
          { status: 400 }
        )
      }
    }

    const draft = await draftService.create(
      {
        type,
        customerId: validCustomerId || undefined,
        items: items.map((item: any) => ({
          productId: item.productId || undefined,
          quantity: item.quantity || 1,
          unitPrice: item.unitPrice || 0,
          discount: item.discount || 0,
          taxRate: item.taxRate || 0,
          notes: item.notes,
        })),
        discount: discount || 0,
        notes: notes || undefined,
      },
      user.id
    )

    return NextResponse.json({
      success: true,
      draft,
    })
  } catch (error) {
    console.error('Error creating draft:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to create draft'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status') || undefined

    const drafts = await draftService.getUserDrafts(user.id, status)

    return NextResponse.json({
      success: true,
      drafts,
    })
  } catch (error) {
    console.error('Error fetching drafts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch drafts' },
      { status: 500 }
    )
  }
}

