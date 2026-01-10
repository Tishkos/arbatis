"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { getTextDirection } from "@/lib/i18n"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"

import { useIsMobile } from '@/hooks/use-mobile'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/components/ui/toggle-group'
import { cn } from "@/lib/utils"

export function ChartAreaInteractive() {
  const params = useParams()
  const locale = (params?.locale as string) || 'ku'
  const t = useTranslations('navigation.dashboardStatistics')
  const fontClass = locale === 'ku' ? 'font-kurdish' : 'font-engar'
  const direction = getTextDirection(locale as 'ku' | 'en' | 'ar')
  const isMobile = useIsMobile()
  const [timeRange, setTimeRange] = React.useState("90d")
  const [currency, setCurrency] = React.useState("all") // all, USD, IQD
  const [chartData, setChartData] = React.useState<Array<{ date: string; iqd: number; usd: number }>>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    if (isMobile) {
      setTimeRange("7d")
    }
  }, [isMobile])

  React.useEffect(() => {
    const fetchSalesData = async () => {
      setLoading(true)
      try {
        const response = await fetch(`/api/statistics/sales-chart?timeRange=${timeRange}&currency=${currency}`)
        if (response.ok) {
          const data = await response.json()
          setChartData(data.data || [])
        }
      } catch (error) {
        console.error('Error fetching sales chart data:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchSalesData()
  }, [timeRange, currency])

  const chartConfig = {
    sales: {
      label: t('totalSales'),
    },
    iqd: {
      label: t('iqd'),
      color: "var(--primary)",
    },
    usd: {
      label: t('usd'),
      color: "hsl(var(--chart-2))",
    },
  } satisfies ChartConfig

  // Process data for chart display - format dates properly for X-axis
  const processedData = chartData.map(item => {
    const dateObj = new Date(item.date)
    return {
      date: dateObj.toISOString().split('T')[0], // Keep ISO format for proper sorting
      dateDisplay: dateObj.toLocaleDateString(locale === 'ku' ? 'en-US' : locale, { month: 'short', day: 'numeric' }),
      iqd: item.iqd,
      usd: item.usd,
      sales: currency === 'all' ? (item.iqd + (item.usd * 1500)) : (currency === 'IQD' ? item.iqd : item.usd), // Approximate USD to IQD conversion when showing all
    }
  }).sort((a, b) => a.date.localeCompare(b.date)) // Sort by date ascending

  const filteredData = processedData

  if (loading) {
    return (
      <Card className={cn("@container/card", fontClass)} dir={direction}>
        <CardHeader>
          <CardTitle className={fontClass}>{t('totalSales')}</CardTitle>
          <CardDescription className={fontClass}>{t('loading')}</CardDescription>
        </CardHeader>
        <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
          <div className={cn("h-[250px] flex items-center justify-center text-muted-foreground", fontClass)}>
            {t('loading')}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn("@container/card", fontClass)} dir={direction}>
      <CardHeader>
        <CardTitle className={fontClass}>{t('totalSales')}</CardTitle>
        <CardDescription className={fontClass}>
          <span className="hidden @[540px]/card:block">
            {t('totalForLastThreeMonths')}
          </span>
          <span className="@[540px]/card:hidden">{t('lastThreeMonths')}</span>
        </CardDescription>
        <CardAction className="flex flex-col gap-2 @[540px]/card:flex-row">
          <ToggleGroup
            type="single"
            value={currency}
            onValueChange={(value) => value && setCurrency(value)}
            variant="outline"
            className="hidden *:data-[slot=toggle-group-item]:!px-4 @[767px]/card:flex"
          >
            <ToggleGroupItem value="all" className={fontClass}>{t('all')}</ToggleGroupItem>
            <ToggleGroupItem value="IQD" className={fontClass}>{t('iqd')}</ToggleGroupItem>
            <ToggleGroupItem value="USD" className={fontClass}>{t('usd')}</ToggleGroupItem>
          </ToggleGroup>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger
              className={cn("flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden", fontClass)}
              size="sm"
            >
              <SelectValue placeholder={t('all')} />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all" className="rounded-lg">{t('all')}</SelectItem>
              <SelectItem value="IQD" className="rounded-lg">{t('iqd')}</SelectItem>
              <SelectItem value="USD" className="rounded-lg">{t('usd')}</SelectItem>
            </SelectContent>
          </Select>
          <ToggleGroup
            type="single"
            value={timeRange}
            onValueChange={(value) => value && setTimeRange(value)}
            variant="outline"
            className="hidden *:data-[slot=toggle-group-item]:!px-4 @[767px]/card:flex"
          >
            <ToggleGroupItem value="90d" className={fontClass}>{t('lastThreeMonths')}</ToggleGroupItem>
            <ToggleGroupItem value="30d" className={fontClass}>{t('last30Days')}</ToggleGroupItem>
            <ToggleGroupItem value="7d" className={fontClass}>{t('last7Days')}</ToggleGroupItem>
          </ToggleGroup>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger
              className={cn("flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden", fontClass)}
              size="sm"
            >
              <SelectValue placeholder={t('lastThreeMonths')} />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="90d" className="rounded-lg">{t('lastThreeMonths')}</SelectItem>
              <SelectItem value="30d" className="rounded-lg">{t('last30Days')}</SelectItem>
              <SelectItem value="7d" className="rounded-lg">{t('last7Days')}</SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        {filteredData.length === 0 ? (
          <div className={cn("h-[250px] flex items-center justify-center text-muted-foreground", fontClass)}>
            {t('noSalesData')}
          </div>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-[250px] w-full"
          >
            <AreaChart data={filteredData}>
              <defs>
                <linearGradient id="fillIQD" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-iqd)"
                    stopOpacity={1.0}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-iqd)"
                    stopOpacity={0.1}
                  />
                </linearGradient>
                <linearGradient id="fillUSD" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-usd)"
                    stopOpacity={0.8}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-usd)"
                    stopOpacity={0.1}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="dateDisplay"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                className={fontClass}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    formatter={(value: any, name: any, item: any, index: any, payload: any) => {
                      const data = payload?.payload || item?.payload || payload
                      if (currency === 'all' && data) {
                        return [
                          `${t('iqd')}: ${(data.iqd || 0).toLocaleString('en-US')} ع.د, ${t('usd')}: $${(data.usd || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                          t('totalSales')
                        ]
                      } else if (currency === 'IQD') {
                        return [`${Number(value).toLocaleString('en-US')} ع.د`, t('iqd')]
                      } else {
                        return [`$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, t('usd')]
                      }
                    }}
                    indicator="dot"
                  />
                }
              />
              {currency === 'all' ? (
                <>
                  <Area
                    dataKey="iqd"
                    type="natural"
                    fill="url(#fillIQD)"
                    stroke="var(--color-iqd)"
                    stackId="a"
                  />
                  <Area
                    dataKey="usd"
                    type="natural"
                    fill="url(#fillUSD)"
                    stroke="var(--color-usd)"
                    stackId="a"
                  />
                </>
              ) : (
                <Area
                  dataKey={currency === 'IQD' ? 'iqd' : 'usd'}
                  type="natural"
                  fill={currency === 'IQD' ? "url(#fillIQD)" : "url(#fillUSD)"}
                  stroke={currency === 'IQD' ? "var(--color-iqd)" : "var(--color-usd)"}
                />
              )}
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
