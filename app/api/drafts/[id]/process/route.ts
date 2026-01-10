import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { DraftService } from '@/modules/drafts/services'

const draftService = new DraftService()

export async function POST(
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
    const draft = await draftService.getById(id)

    if (!draft) {
      return NextResponse.json(
        { error: 'Draft not found' },
        { status: 404 }
      )
    }

    // Allow processing if draft is CREATED or READY (in case it was already processed)
    if (draft.status !== 'CREATED' && draft.status !== 'READY') {
      return NextResponse.json(
        { error: 'Draft must be in CREATED or READY status to process' },
        { status: 400 }
      )
    }

    // Update status to READY (processed)
    const updatedDraft = await draftService.updateStatus(id, 'READY')

    return NextResponse.json({
      success: true,
      draft: updatedDraft,
    })
  } catch (error) {
    console.error('Error processing draft:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to process draft'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

