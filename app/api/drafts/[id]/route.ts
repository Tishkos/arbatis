import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { DraftService } from '@/modules/drafts/services'

const draftService = new DraftService()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = await params
    const draft = await draftService.getById(id)

    if (!draft) {
      return NextResponse.json(
        { error: 'Draft not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      draft,
    })
  } catch (error) {
    console.error('Error fetching draft:', error)
    return NextResponse.json(
      { error: 'Failed to fetch draft' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params
    const body = await request.json()
    const {
      customerId,
      items = [],
      discount = 0,
      notes,
    } = body

    const draft = await draftService.update(
      id,
      {
        customerId: customerId || undefined,
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
    console.error('Error updating draft:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to update draft'
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
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = await params
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    await draftService.cancel(id, user.id)

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    console.error('Error cancelling draft:', error)
    return NextResponse.json(
      { error: 'Failed to cancel draft' },
      { status: 500 }
    )
  }
}

