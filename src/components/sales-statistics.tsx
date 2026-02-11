"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { getTextDirection } from "@/lib/i18n"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { IconAlertCircle, IconUsers, IconPackage, IconShoppingCart, IconTrendingUp } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { getServeUrl } from "@/lib/serve-url"
import Link from "next/link"

interface SalesStatisticsProps {
  locale: string
}

export function SalesStatistics({ locale }: SalesStatisticsProps) {
  const t = useTranslations('navigation.salesStatistics')
  const fontClass = locale === 'ku' ? 'font-kurdish' : 'font-engar'
  const direction = getTextDirection(locale as 'ku' | 'en' | 'ar')
  const [lowStockProducts, setLowStockProducts] = React.useState<any[]>([])
  const [topCustomers, setTopCustomers] = React.useState<any[]>([])
  const [topProducts, setTopProducts] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const fetchStatistics = async () => {
      try {
        const [lowStockRes, topCustomersRes, topProductsRes] = await Promise.all([
          fetch('/api/statistics/low-stock').then(res => res.json()),
          fetch('/api/statistics/top-customers').then(res => res.json()),
          fetch('/api/statistics/most-sold').then(res => res.json()),
        ])

        if (lowStockRes.products) setLowStockProducts(lowStockRes.products)
        if (topCustomersRes.customers) setTopCustomers(topCustomersRes.customers)
        if (topProductsRes.products) setTopProducts(topProductsRes.products)
      } catch (error) {
        console.error('Error fetching statistics:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStatistics()
  }, [])

  if (loading) {
    return <div className={cn("text-center py-4 text-muted-foreground", fontClass)}>{t('loading')}</div>
  }

  return (
    <div className={cn("grid grid-cols-1 gap-6 lg:grid-cols-3 px-4 lg:px-6", fontClass)} dir={direction}>
      {/* Low Stock Products */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <IconAlertCircle className="h-5 w-5 text-destructive" />
            <CardTitle className={cn("text-lg", fontClass)}>{t('lowStockProducts.title')}</CardTitle>
          </div>
          <CardDescription className={cn("text-sm", fontClass)}>
            {t('lowStockProducts.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {lowStockProducts.length > 0 ? (
              lowStockProducts.slice(0, 5).map((product) => (
                <Link
                  key={product.id}
                  href={`/${locale}/products/${product.id}`}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={getServeUrl(product.image) || product.image || undefined} />
                    <AvatarFallback>
                      <IconPackage className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-medium truncate", fontClass)}>{product.name}</p>
                    <p className={cn("text-xs text-muted-foreground", fontClass)}>{product.sku}</p>
                  </div>
                  <Badge variant="destructive" className={fontClass}>
                    {product.stockQuantity}/{product.lowStockThreshold}
                  </Badge>
                </Link>
              ))
            ) : (
              <p className={cn("text-sm text-muted-foreground text-center py-4", fontClass)}>
                {t('lowStockProducts.noProducts')}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Top Customers */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <IconUsers className="h-5 w-5 text-primary" />
            <CardTitle className={cn("text-lg", fontClass)}>{t('topCustomers.title')}</CardTitle>
          </div>
          <CardDescription className={cn("text-sm", fontClass)}>
            {t('topCustomers.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {topCustomers.length > 0 ? (
              topCustomers.slice(0, 5).map((customer: any, index: number) => (
                <Link
                  key={customer?.id || index}
                  href={customer?.id ? `/${locale}/customers/${customer.id}` : '#'}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                    <span className={cn("text-xs font-bold text-primary", fontClass)}>
                      {index + 1}
                    </span>
                  </div>
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={customer?.image || undefined} />
                    <AvatarFallback>
                      <IconUsers className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-medium truncate", fontClass)}>
                      {customer?.name || 'Unknown Customer'}
                    </p>
                    <p className={cn("text-xs text-muted-foreground", fontClass)}>
                      {customer?.sku || 'N/A'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={cn("text-sm font-semibold", fontClass)}>
                      {customer?.totalOrders || 0} {t('topCustomers.invoices')}
                    </p>
                  </div>
                </Link>
              ))
            ) : (
              <p className={cn("text-sm text-muted-foreground text-center py-4", fontClass)}>
                {t('topCustomers.noData')}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Top Products by Sales */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <IconTrendingUp className="h-5 w-5 text-primary" />
            <CardTitle className={cn("text-lg", fontClass)}>{t('mostSoldProducts.title')}</CardTitle>
          </div>
          <CardDescription className={cn("text-sm", fontClass)}>
            {t('mostSoldProducts.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {topProducts.length > 0 ? (
              topProducts.slice(0, 5).map((product: any, index: number) => (
                <Link
                  key={product?.id || index}
                  href={product?.id ? `/${locale}/products/${product.id}` : '#'}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                    <span className={cn("text-xs font-bold text-primary", fontClass)}>
                      {index + 1}
                    </span>
                  </div>
                  <IconShoppingCart className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-medium truncate", fontClass)}>
                      {product?.name || 'Unknown Product'}
                    </p>
                    <p className={cn("text-xs text-muted-foreground", fontClass)}>
                      {product?.sku || 'N/A'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={cn("text-sm font-semibold", fontClass)}>
                      {product?.totalSold || 0} {t('mostSoldProducts.sold')}
                    </p>
                  </div>
                </Link>
              ))
            ) : (
              <p className={cn("text-sm text-muted-foreground text-center py-4", fontClass)}>
                {t('mostSoldProducts.noData')}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

