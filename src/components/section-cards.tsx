"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { getTextDirection } from "@/lib/i18n"
import { IconTrendingDown, IconTrendingUp, IconPackage, IconMotorbike, IconFileInvoice } from "@tabler/icons-react"

import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { cn } from "@/lib/utils"

export function SectionCards() {
  const params = useParams()
  const locale = (params?.locale as string) || 'ku'
  const t = useTranslations('navigation.dashboardStatistics')
  const fontClass = locale === 'ku' ? 'font-kurdish' : 'font-engar'
  const direction = getTextDirection(locale as 'ku' | 'en' | 'ar')
  
  const [stats, setStats] = React.useState<{
    totalRevenueIqd: number
    totalRevenueUsd: number
    newCustomers: number
    totalCustomers: number
    activeAccounts: number
    growthRate: number
    totalProducts: number
    totalMotorcycles: number
    totalInvoices: number
  } | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/statistics/dashboard')
        if (response.ok) {
          const data = await response.json()
          setStats(data)
        }
      } catch (error) {
        console.error('Error fetching dashboard stats:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  if (loading) {
    return (
      <div className={cn("grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4", fontClass)} dir={direction}>
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <Card key={i} className="@container/card">
            <CardHeader>
              <div className="flex items-center justify-center h-20">
                <Spinner />
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    )
  }

  if (!stats) {
    return null
  }

  const revenueDisplay = stats.totalRevenueIqd > 0 && stats.totalRevenueUsd > 0
    ? `${stats.totalRevenueIqd.toLocaleString('en-US')} ع.د + $${stats.totalRevenueUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : stats.totalRevenueIqd > 0
    ? `${stats.totalRevenueIqd.toLocaleString('en-US')} ع.د`
    : `$${stats.totalRevenueUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const growthIcon = stats.growthRate >= 0 ? IconTrendingUp : IconTrendingDown
  const GrowthIcon = growthIcon

  return (
    <div className={cn("*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4", fontClass)} dir={direction}>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription className={fontClass}>{t('totalRevenue')}</CardDescription>
          <CardTitle className={cn("text-2xl font-semibold tabular-nums @[250px]/card:text-3xl", fontClass)}>
            {revenueDisplay}
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className={fontClass}>
              {stats.totalRevenueIqd > 0 && stats.totalRevenueUsd > 0 && (
                <>
                  <span>{t('iqd')} + {t('usd')}</span>
                </>
              )}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className={cn("line-clamp-1 flex gap-2 font-medium", fontClass)}>
            {t('totalRevenueDescription')}
          </div>
          <div className={cn("text-muted-foreground", fontClass)}>
            {stats.totalRevenueIqd > 0 && `${t('iqd')}: ${stats.totalRevenueIqd.toLocaleString('en-US')} ع.د`}
            {stats.totalRevenueIqd > 0 && stats.totalRevenueUsd > 0 && ' • '}
            {stats.totalRevenueUsd > 0 && `${t('usd')}: $${stats.totalRevenueUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription className={fontClass}>{t('newCustomers')}</CardDescription>
          <CardTitle className={cn("text-2xl font-semibold tabular-nums @[250px]/card:text-3xl", fontClass)}>
            {stats.newCustomers.toLocaleString('en-US')}
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className={fontClass}>
              <GrowthIcon className="h-3 w-3" />
              {stats.growthRate >= 0 ? '+' : ''}{stats.growthRate.toFixed(1)}%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className={cn("line-clamp-1 flex gap-2 font-medium", fontClass)}>
            {stats.growthRate >= 0 ? t('growing') : t('declining')} <GrowthIcon className="size-4" />
          </div>
          <div className={cn("text-muted-foreground", fontClass)}>
            {t('newCustomersDescription')}
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription className={fontClass}>{t('activeAccounts')}</CardDescription>
          <CardTitle className={cn("text-2xl font-semibold tabular-nums @[250px]/card:text-3xl", fontClass)}>
            {stats.activeAccounts.toLocaleString('en-US')}
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className={fontClass}>
              {stats.totalCustomers > 0 
                ? `${Math.round((stats.activeAccounts / stats.totalCustomers) * 100)}%`
                : '0%'}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className={cn("line-clamp-1 flex gap-2 font-medium", fontClass)}>
            {t('activeAccountsDescription')} <IconTrendingUp className="size-4" />
          </div>
          <div className={cn("text-muted-foreground", fontClass)}>
            {stats.totalCustomers} {t('totalCustomersLabel')}
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription className={fontClass}>{t('growthRate')}</CardDescription>
          <CardTitle className={cn("text-2xl font-semibold tabular-nums @[250px]/card:text-3xl", fontClass)}>
            {stats.growthRate >= 0 ? '+' : ''}{stats.growthRate.toFixed(1)}%
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className={fontClass}>
              <GrowthIcon className="h-3 w-3" />
              {stats.growthRate >= 0 ? '+' : ''}{stats.growthRate.toFixed(1)}%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className={cn("line-clamp-1 flex gap-2 font-medium", fontClass)}>
            {stats.growthRate >= 0 ? t('steadyPerformanceIncrease') : t('performanceDecline')} <GrowthIcon className="size-4" />
          </div>
          <div className={cn("text-muted-foreground", fontClass)}>{t('growthRateDescription')}</div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription className={fontClass}>{t('totalProducts')}</CardDescription>
          <CardTitle className={cn("text-2xl font-semibold tabular-nums @[250px]/card:text-3xl", fontClass)}>
            {stats.totalProducts.toLocaleString('en-US')}
          </CardTitle>
          <CardAction>
            <IconPackage className="h-5 w-5 text-primary" />
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className={cn("line-clamp-1 flex gap-2 font-medium", fontClass)}>
            {t('totalProductsDescription')}
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription className={fontClass}>{t('totalMotorcycles')}</CardDescription>
          <CardTitle className={cn("text-2xl font-semibold tabular-nums @[250px]/card:text-3xl", fontClass)}>
            {stats.totalMotorcycles.toLocaleString('en-US')}
          </CardTitle>
          <CardAction>
            <IconMotorbike className="h-5 w-5 text-primary" />
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className={cn("line-clamp-1 flex gap-2 font-medium", fontClass)}>
            {t('totalMotorcyclesDescription')}
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription className={fontClass}>{t('totalInvoices')}</CardDescription>
          <CardTitle className={cn("text-2xl font-semibold tabular-nums @[250px]/card:text-3xl", fontClass)}>
            {stats.totalInvoices.toLocaleString('en-US')}
          </CardTitle>
          <CardAction>
            <IconFileInvoice className="h-5 w-5 text-primary" />
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className={cn("line-clamp-1 flex gap-2 font-medium", fontClass)}>
            {t('totalInvoicesDescription')}
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
