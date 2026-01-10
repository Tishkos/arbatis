import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { CustomerDetail } from '@/components/customer-detail'

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  const { locale, id } = await params

  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    notFound()
  }

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      address: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  })

  if (!customer) {
    notFound()
  }

  // Fetch user data separately
  let createdBy = null
  
  if (customer.createdById) {
    createdBy = await prisma.user.findUnique({
      where: { id: customer.createdById },
      select: {
        id: true,
        name: true,
        email: true,
      },
    })
  }

  // Calculate days overdue
  let daysOverdue = 0
  const hasDebt = Number(customer.debtIqd) > 0 || Number(customer.debtUsd) > 0
  if (customer.lastPaymentDate && hasDebt) {
    const lastPayment = new Date(customer.lastPaymentDate)
    const now = new Date()
    // Calculate days since last payment (not absolute - only count if payment is in the past)
    const diffTime = now.getTime() - lastPayment.getTime()
    const daysSincePayment = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    // Only set as overdue if payment was in the past (positive days)
    daysOverdue = daysSincePayment > 0 ? daysSincePayment : 0
  } else if (!hasDebt) {
    daysOverdue = 0
  }

  // Combine customer data with user data and convert Decimal to number
  // Ensure email field is from customer, not createdBy
  const customerWithUsers = {
    ...customer,
    email: customer.email, // Explicitly use customer email
    debtIqd: Number(customer.debtIqd),
    debtUsd: Number(customer.debtUsd),
    currentBalance: Number(customer.currentBalance),
    daysOverdue,
    createdBy,
    address: customer.address || null, // Include address from include
  }

  return <CustomerDetail customer={customerWithUsers} locale={locale} />
}

