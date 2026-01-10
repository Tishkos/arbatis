"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { getTextDirection } from "@/lib/i18n"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Bar, BarChart, Line, LineChart, Pie, PieChart, Cell, XAxis, YAxis, CartesianGrid } from "recharts"
import { IconTrendingUp, IconFileInvoice, IconCurrencyDollar, IconShoppingCart } from "@tabler/icons-react"
import { cn } from "@/lib/utils"

interface StatisticsChartsProps {
  locale: string
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d']

export function StatisticsCharts({ locale }: StatisticsChartsProps) {
  const t = useTranslations('navigation.dashboardStatistics')
  const fontClass = locale === 'ku' ? 'font-kurdish' : 'font-engar'
  const direction = getTextDirection(locale as 'ku' | 'en' | 'ar')
  const [salesData, setSalesData] = React.useState<any[]>([])
  const [invoiceStatusData, setInvoiceStatusData] = React.useState<any[]>([])
  const [monthlyRevenue, setMonthlyRevenue] = React.useState<any[]>([])
  const [topProducts, setTopProducts] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const fetchStatistics = async () => {
      try {
        // Fetch sales data for the last 7 days - use limit to get more data for better charts
        const salesRes = await fetch('/api/statistics/activities?limit=500')
        const salesData = await salesRes.json()
        
        // Process sales data for daily revenue chart
        const dailyRevenue = processDailyRevenue(salesData.activities || [])
        setSalesData(dailyRevenue)

        // Process invoice status distribution
        const statusDistribution = processInvoiceStatus(salesData.activities || [])
        setInvoiceStatusData(statusDistribution)

        // Process monthly revenue - fetch all activities for better monthly data
        const monthlyRes = await fetch('/api/statistics/activities?limit=1000')
        const monthlyData = await monthlyRes.json()
        const monthly = processMonthlyRevenue(monthlyData.activities || [])
        setMonthlyRevenue(monthly)

        // Fetch top products
        const productsRes = await fetch('/api/statistics/most-sold')
        const productsData = await productsRes.json()
        const topProductsData = (productsData.products || []).slice(0, 5).map((p: any, idx: number) => ({
          name: p.name || `Product ${idx + 1}`,
          value: p.totalSold || 0,
        }))
        setTopProducts(topProductsData)
      } catch (error) {
        console.error('Error fetching statistics:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStatistics()
  }, [])

  const processDailyRevenue = (activities: any[]) => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date()
      date.setDate(date.getDate() - (6 - i))
      return {
        date: date.toISOString().split('T')[0],
        iqd: 0,
        usd: 0,
      }
    })

    activities.forEach((activity: any) => {
      const activityDate = new Date(activity.date).toISOString().split('T')[0]
      const dayIndex = last7Days.findIndex(d => d.date === activityDate)
      if (dayIndex !== -1) {
        const currency = activity.currency || (activity.isMotorcycle ? 'USD' : 'IQD')
        if (currency === 'USD') {
          last7Days[dayIndex].usd += activity.amount || 0
        } else {
          last7Days[dayIndex].iqd += activity.amount || 0
        }
      }
    })

    return last7Days.map(d => ({
      date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      iqd: Math.round(d.iqd),
      usd: Math.round(d.usd),
      revenue: Math.round(d.iqd + (d.usd * 1500)), // Approximate USD to IQD for combined display
    }))
  }

  const processInvoiceStatus = (activities: any[]) => {
    const statusCount: Record<string, number> = {}
    activities.forEach((activity: any) => {
      const status = activity.status || 'UNKNOWN'
      statusCount[status] = (statusCount[status] || 0) + 1
    })

    const statusLabels: Record<string, string> = {
      'PAID': t('statusPaidLabel'),
      'PARTIALLY_PAID': t('statusPartiallyPaidLabel'),
      'UNPAID': t('statusUnpaidLabel'),
      'FINALIZED': t('statusFinalizedLabel'),
      'DRAFT': t('statusDraftLabel'),
      'CANCELLED': t('statusCancelledLabel'),
    }

    return Object.entries(statusCount).map(([name, value]) => ({
      name: statusLabels[name] || name.replace('_', ' '),
      value,
    }))
  }

  const processMonthlyRevenue = (activities: any[]) => {
    const last6Months = Array.from({ length: 6 }, (_, i) => {
      const date = new Date()
      date.setMonth(date.getMonth() - (5 - i))
      return {
        month: date.toLocaleDateString('en-US', { month: 'short' }),
        iqd: 0,
        usd: 0,
      }
    })

    activities.forEach((activity: any) => {
      const activityDate = new Date(activity.date)
      const monthName = activityDate.toLocaleDateString('en-US', { month: 'short' })
      const monthIndex = last6Months.findIndex(m => m.month === monthName)
      if (monthIndex !== -1) {
        const currency = activity.currency || (activity.isMotorcycle ? 'USD' : 'IQD')
        if (currency === 'USD') {
          last6Months[monthIndex].usd += activity.amount || 0
        } else {
          last6Months[monthIndex].iqd += activity.amount || 0
        }
      }
    })

    return last6Months.map(m => ({
      month: m.month,
      iqd: Math.round(m.iqd),
      usd: Math.round(m.usd),
      revenue: Math.round(m.iqd + (m.usd * 1500)), // Approximate USD to IQD for combined display
    }))
  }

  const salesChartConfig = {
    revenue: {
      label: "Revenue",
      color: "hsl(var(--chart-1))",
    },
  } satisfies ChartConfig

  const invoiceChartConfig = {
    count: {
      label: "Count",
      color: "hsl(var(--chart-2))",
    },
  } satisfies ChartConfig

  if (loading) {
    return (
      <div className={cn("grid grid-cols-1 gap-6 lg:grid-cols-2 px-4 lg:px-6", fontClass)} dir={direction}>
        <div className={cn("text-center py-8 text-muted-foreground", fontClass)}>
          {t('loading')}
        </div>
      </div>
    )
  }

  return (
    <div className={cn("grid grid-cols-1 gap-6 lg:grid-cols-2 px-4 lg:px-6", fontClass)} dir={direction}>
      {/* Daily Revenue Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <IconTrendingUp className="h-5 w-5 text-primary" />
            <CardTitle className={cn("text-lg", fontClass)}>{t('dailyRevenue')}</CardTitle>
          </div>
          <CardDescription className={cn("text-sm", fontClass)}>
            {t('dailyRevenueDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={salesChartConfig} className="h-[300px]">
            <LineChart data={salesData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis 
                dataKey="date" 
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <YAxis 
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <ChartTooltip 
                cursor={false} 
                content={
                  <ChartTooltipContent
                    formatter={(value: any, name: any, item: any, index: any, payload: any) => {
                      const data = payload?.payload || item?.payload || payload
                      if (data) {
                        return [
                          `${t('iqd')}: ${(data.iqd || 0).toLocaleString('en-US')} ع.د, ${t('usd')}: $${(data.usd || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                          t('totalSales')
                        ]
                      }
                      return [`${Number(value).toLocaleString('en-US')}`, t('totalSales')]
                    }}
                  />
                } 
              />
              <Line 
                type="monotone" 
                dataKey="revenue" 
                stroke="var(--color-revenue)" 
                strokeWidth={2}
                dot={{ r: 4 }}
              />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Invoice Status Distribution */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <IconFileInvoice className="h-5 w-5 text-primary" />
            <CardTitle className={cn("text-lg", fontClass)}>{t('invoiceStatusDistribution')}</CardTitle>
          </div>
          <CardDescription className={cn("text-sm", fontClass)}>
            {t('invoiceStatusDistributionDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={invoiceChartConfig} className="h-[300px]">
            <PieChart>
              <Pie
                data={invoiceStatusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {invoiceStatusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <ChartTooltip content={<ChartTooltipContent />} />
            </PieChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Monthly Revenue */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <IconCurrencyDollar className="h-5 w-5 text-primary" />
            <CardTitle className={cn("text-lg", fontClass)}>{t('monthlyRevenue')}</CardTitle>
          </div>
          <CardDescription className={cn("text-sm", fontClass)}>
            {t('monthlyRevenueDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={salesChartConfig} className="h-[300px]">
            <BarChart data={monthlyRevenue}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis 
                dataKey="month" 
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <YAxis 
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <ChartTooltip 
                cursor={false} 
                content={
                  <ChartTooltipContent
                    formatter={(value: any, name: any, item: any, index: any, payload: any) => {
                      const data = payload?.payload || item?.payload || payload
                      if (data) {
                        return [
                          `${t('iqd')}: ${(data.iqd || 0).toLocaleString('en-US')} ع.د, ${t('usd')}: $${(data.usd || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                          t('totalSales')
                        ]
                      }
                      return [`${Number(value).toLocaleString('en-US')}`, t('totalSales')]
                    }}
                  />
                } 
              />
              <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Top Products */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <IconShoppingCart className="h-5 w-5 text-primary" />
            <CardTitle className={cn("text-lg", fontClass)}>{t('topProductsBySales')}</CardTitle>
          </div>
          <CardDescription className={cn("text-sm", fontClass)}>
            {t('topProductsDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={invoiceChartConfig} className="h-[300px]">
            <BarChart data={topProducts} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis 
                type="number" 
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <YAxis 
                dataKey="name" 
                type="category" 
                width={100}
                tickLine={false}
                axisLine={false}
              />
              <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
              <Bar dataKey="value" fill="var(--color-count)" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  )
}

