"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { getTextDirection } from "@/lib/i18n"
import { format } from "date-fns"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { IconActivity, IconSearch, IconPackage, IconMotorbike, IconChevronLeft, IconChevronRight } from "@tabler/icons-react"
import { cn } from "@/lib/utils"

interface SalesActivitiesTableProps {
  locale: string
}

export function SalesActivitiesTable({ locale }: SalesActivitiesTableProps) {
  const t = useTranslations('navigation.salesActivities')
  const fontClass = locale === 'ku' ? 'font-kurdish' : 'font-engar'
  const direction = getTextDirection(locale as 'ku' | 'en' | 'ar')
  const [activities, setActivities] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)
  const [loadingMore, setLoadingMore] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [page, setPage] = React.useState(1)
  const [pagination, setPagination] = React.useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  })
  const [isManualPagination, setIsManualPagination] = React.useState(false)
  const observerTarget = React.useRef<HTMLDivElement>(null)

  // Fetch activities with pagination
  const fetchActivities = React.useCallback(async (pageNum: number, search: string, append: boolean = false) => {
    try {
      if (!append) {
        setLoading(true)
      } else {
        setLoadingMore(true)
      }
      
      const params = new URLSearchParams({
        page: pageNum.toString(),
        pageSize: '20',
      })
      if (search) {
        params.append('search', search)
      }
      
      const res = await fetch(`/api/statistics/activities?${params.toString()}`)
      const data = await res.json()
      
      if (append) {
        setActivities(prev => [...prev, ...(data.activities || [])])
      } else {
        setActivities(data.activities || [])
      }
      
      if (data.pagination) {
        setPagination(data.pagination)
      }
    } catch (error) {
      console.error('Error fetching activities:', error)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  // Initial load and search
  React.useEffect(() => {
    const debounceTimer = setTimeout(() => {
      setPage(1)
      setIsManualPagination(false) // Reset to allow lazy loading after search
      fetchActivities(1, searchQuery, false)
    }, 300)

    return () => clearTimeout(debounceTimer)
  }, [searchQuery, fetchActivities])

  // Load more on scroll (lazy loading) - only if not using manual pagination
  React.useEffect(() => {
    if (isManualPagination) return // Disable lazy loading when using manual pagination
    
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingMore && page < pagination.totalPages) {
          const nextPage = page + 1
          setPage(nextPage)
          fetchActivities(nextPage, searchQuery, true)
        }
      },
      { threshold: 0.1 }
    )

    const currentTarget = observerTarget.current
    if (currentTarget) {
      observer.observe(currentTarget)
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget)
      }
    }
  }, [page, pagination.totalPages, loadingMore, searchQuery, fetchActivities, isManualPagination])

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", label: string }> = {
      PAID: { variant: "default", label: t('statusPaid') },
      PARTIALLY_PAID: { variant: "secondary", label: t('statusPartiallyPaid') },
      DRAFT: { variant: "secondary", label: t('statusDraft') },
      CANCELLED: { variant: "destructive", label: t('statusCancelled') },
      OVERDUE: { variant: "destructive", label: t('statusOverdue') },
    }
    const statusInfo = statusMap[status] || { variant: "outline" as const, label: status }
    return <Badge variant={statusInfo.variant} className={fontClass}>{statusInfo.label}</Badge>
  }

  const getSaleTypeIcon = (activity: any) => {
    const isWholesale = activity.saleType === "JUMLA"
    const isRetail = activity.saleType === "MUFRAD"
    const isMotorcycle = activity.isMotorcycle

    // For now, we'll show product icons by default
    // You can enhance this later to detect motorcycles from product data
    if (isMotorcycle) {
      if (isWholesale) {
        // Two motorcycles stacked for wholesale - almost overlapping
        return (
          <div className="relative flex items-center justify-center w-5 h-5">
            <IconMotorbike className="h-4 w-4 text-primary absolute top-0 left-0" />
            <IconMotorbike className="h-4 w-4 text-primary opacity-50 absolute top-0.5 left-0.5" />
          </div>
        )
      } else {
        // One motorcycle for retail
        return <IconMotorbike className="h-4 w-4 text-primary" />
      }
    } else {
      // Default to product icons
      if (isWholesale) {
        // Two products stacked for wholesale - almost overlapping
        return (
          <div className="relative flex items-center justify-center w-5 h-5">
            <IconPackage className="h-4 w-4 text-primary absolute top-0 left-0" />
            <IconPackage className="h-4 w-4 text-primary opacity-50 absolute top-0.5 left-0.5" />
          </div>
        )
      } else {
        // One product for retail
        return <IconPackage className="h-4 w-4 text-primary" />
      }
    }
  }

  return (
    <div className="px-4 lg:px-6">
      <Card className="py-6">
        <CardHeader className="pb-6 px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <IconActivity className="h-5 w-5 text-primary" />
              <CardTitle className={cn("text-lg font-semibold", fontClass)}>{t('title')}</CardTitle>
            </div>
          </div>
          <CardDescription className={cn("text-sm mt-2", fontClass)}>
            {t('cardDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-6">
        {/* Search Bar */}
        <div className="relative">
          <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder={t('searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn("pl-9", fontClass)}
            dir={direction}
          />
        </div>

        {loading ? (
          <div className={cn("text-center py-8 text-muted-foreground", fontClass)}>
            <Spinner className="mx-auto mb-2" />
            <p>{t('loading')}</p>
          </div>
        ) : activities.length > 0 ? (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className={fontClass}>{t('date')}</TableHead>
                    <TableHead className={fontClass}>{t('invoiceNumber')}</TableHead>
                    <TableHead className={fontClass}>{t('description')}</TableHead>
                    <TableHead className={fontClass}>{t('amount')}</TableHead>
                    <TableHead className={fontClass}>{t('status')}</TableHead>
                    <TableHead className={fontClass}>{t('createdBy')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activities.map((activity) => (
                    <TableRow key={activity.id}>
                      <TableCell className={fontClass}>
                        {format(new Date(activity.date), 'PPp')}
                      </TableCell>
                      <TableCell className={fontClass}>
                        <div className="flex items-center gap-3">
                          {getSaleTypeIcon(activity)}
                          <Badge variant="outline" className={fontClass}>
                            {activity.invoiceNumber || activity.title}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className={fontClass}>
                        {activity.customer
                          ? t('invoiceForCustomer', { name: activity.customer.name, sku: activity.customer.sku })
                          : t('invoice')}
                      </TableCell>
                      <TableCell className={cn("font-medium", fontClass)}>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={cn("text-xs", fontClass)}>
                            {activity.currency === 'USD' ? t('currencyUSD') : t('currencyIQD')}
                          </Badge>
                          <span>
                            {activity.currency === 'USD' ? '$' : 'ع.د '}
                            {activity.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(activity.status)}
                      </TableCell>
                      <TableCell className={cn("text-muted-foreground", fontClass)}>
                        {activity.createdBy || t('unknown')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            
            {/* Pagination Info */}
            <div className="flex items-center justify-between pt-4">
              <div className={cn("text-sm text-muted-foreground", fontClass)}>
                {t('showing')} {activities.length} {t('of')} {pagination.total} {t('activities')}
                {pagination.totalPages > 1 && (
                  <span> ({t('page')} {pagination.page} {t('of')} {pagination.totalPages})</span>
                )}
              </div>
              
              {/* Manual Pagination Buttons (optional, for better UX) */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (page > 1) {
                        setIsManualPagination(true)
                        const newPage = page - 1
                        setPage(newPage)
                        fetchActivities(newPage, searchQuery, false)
                        window.scrollTo({ top: 0, behavior: 'smooth' })
                      }
                    }}
                    disabled={page === 1 || loading}
                    className={fontClass}
                  >
                    <IconChevronLeft className="h-4 w-4 mr-1" />
                    {t('previous')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (page < pagination.totalPages) {
                        setIsManualPagination(true)
                        const newPage = page + 1
                        setPage(newPage)
                        fetchActivities(newPage, searchQuery, false)
                        window.scrollTo({ top: 0, behavior: 'smooth' })
                      }
                    }}
                    disabled={page >= pagination.totalPages || loading}
                    className={fontClass}
                  >
                    {t('next')}
                    <IconChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              )}
            </div>
            
            {/* Lazy Loading Trigger */}
            {loadingMore && (
              <div className={cn("text-center py-4", fontClass)}>
                <Spinner className="mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">{t('loadingMore')}</p>
              </div>
            )}
            
            {/* Intersection Observer Target for Auto-Load More */}
            <div ref={observerTarget} className="h-4" />
          </>
        ) : (
          <div className={cn("text-center py-8 text-muted-foreground", fontClass)}>
            {searchQuery ? t('noActivitiesSearch') : t('noActivities')}
          </div>
        )}
        </CardContent>
      </Card>
    </div>
  )
}

