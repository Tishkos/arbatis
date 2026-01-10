import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { SalesInvoiceForm } from '@/components/sales-invoice-form'

export default async function InvoiceEditPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  const { locale, id } = await params

  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    notFound()
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      customer: true,
      sale: {
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      },
      items: {
        include: {
          product: true,
        },
        orderBy: {
          order: 'asc',
        },
      },
      draft: true,
    },
  })

  if (!invoice) {
    notFound()
  }

  // Determine sale type from invoice
  const isWholesale = invoice.sale?.type === 'JUMLA'
  const isRetail = invoice.sale?.type === 'MUFRAD'
  // Check if it's a motorcycle invoice (check if any item has motorcycle in product name or check sale items)
  const isMotorcycle = invoice.items.some((item) => 
    item.product?.name?.toLowerCase().includes('motorcycle')
  ) || invoice.sale?.items?.some((item) => 
    item.product?.name?.toLowerCase().includes('motorcycle')
  )

  let saleType: "wholesale-product" | "retail-product" | "wholesale-motorcycle" | "retail-motorcycle"
  if (isWholesale && isMotorcycle) {
    saleType = 'wholesale-motorcycle'
  } else if (isWholesale) {
    saleType = 'wholesale-product'
  } else if (isRetail && isMotorcycle) {
    saleType = 'retail-motorcycle'
  } else {
    saleType = 'retail-product'
  }

  // Create a tab ID for this edit session
  const tabId = `edit-${id}`

  return (
    <SalesInvoiceForm
      tabId={tabId}
      saleType={saleType}
      locale={locale}
      invoiceId={id}
    />
  )
}

