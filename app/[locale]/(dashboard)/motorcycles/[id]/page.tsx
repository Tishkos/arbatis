import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { MotorcycleDetail } from '@/components/motorcycle-detail'

export default async function MotorcycleDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  const { locale, id } = await params

  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    notFound()
  }

  // Try to fetch with category relation first (new schema)
  let motorcycle
  try {
    motorcycle = await prisma.motorcycle.findUnique({
      where: { id },
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })
  } catch (error: any) {
    // If category relation doesn't exist (old schema), fetch without it
    if (error?.code === 'P2019' || error?.message?.includes('category')) {
      motorcycle = await prisma.motorcycle.findUnique({
        where: { id },
      })
      // Add null category for old schema
      if (motorcycle) {
        motorcycle = {
          ...motorcycle,
          category: null,
        } as any
      }
    } else {
      throw error
    }
  }

  if (!motorcycle) {
    notFound()
  }

  // Fetch user data separately if needed
  let createdBy = null
  let updatedBy = null
  
  if (motorcycle.createdById) {
    createdBy = await prisma.user.findUnique({
      where: { id: motorcycle.createdById },
      select: {
        id: true,
        name: true,
        email: true,
      },
    })
  }
  
  if (motorcycle.updatedById) {
    updatedBy = await prisma.user.findUnique({
      where: { id: motorcycle.updatedById },
      select: {
        id: true,
        name: true,
        email: true,
      },
    })
  }

  // Combine motorcycle data with user data and convert Decimal to number
  const motorcycleWithUsers = {
    ...motorcycle,
    usdRetailPrice: Number(motorcycle.usdRetailPrice),
    usdWholesalePrice: Number(motorcycle.usdWholesalePrice),
    rmbPrice: motorcycle.rmbPrice ? Number(motorcycle.rmbPrice) : null,
    category: (motorcycle as any).category || null, // Preserve category relation
    createdBy,
    updatedBy,
  }

  return <MotorcycleDetail motorcycle={motorcycleWithUsers} locale={locale} />
}

