import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { ProductDetail } from '@/components/product-detail'

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  const { locale, id } = await params

  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    notFound()
  }

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      category: true,
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      updatedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  })

  if (!product) {
    notFound()
  }

  // Convert Decimal fields to numbers for client component
  const productWithNumbers = {
    ...product,
    purchasePrice: Number(product.purchasePrice),
    mufradPrice: Number(product.mufradPrice),
    jumlaPrice: Number(product.jumlaPrice),
    rmbPrice: product.rmbPrice ? Number(product.rmbPrice) : null,
    defaultTaxRate: Number(product.defaultTaxRate),
  }

  return <ProductDetail product={productWithNumbers} locale={locale} />
}


