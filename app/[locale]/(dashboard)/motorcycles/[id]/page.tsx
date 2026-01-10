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

  const motorcycle = await prisma.motorcycle.findUnique({
    where: { id },
  })

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
    createdBy,
    updatedBy,
  }

  return <MotorcycleDetail motorcycle={motorcycleWithUsers} locale={locale} />
}

