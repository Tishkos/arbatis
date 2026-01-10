'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { IconBell, IconAlertTriangle, IconPackage, IconBike as IconMotorcycle, IconUsers } from '@tabler/icons-react'
import { cn } from '@/lib/utils'

type LowStockItem = {
  id: string
  sku: string
  stockQuantity: number
  lowStockThreshold: number
  image: string | null
  type: 'product' | 'motorcycle'
  displayName: string
}

type OverdueCustomer = {
  id: string
  name: string
  sku: string
  phone: string | null
  email: string | null
  image: string | null
  debtIqd: number
  debtUsd: number
  daysOverdue: number
  notificationDays: number | null
  notificationType: string | null
  lastPaymentDate: Date | string | null
  type: 'customer'
  displayName: string
}

export function NotificationDropdown() {
  const router = useRouter()
  const params = useParams()
  const locale = (params?.locale as string) || 'en'
  const t = useTranslations('notifications')
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([])
  const [overdueCustomers, setOverdueCustomers] = useState<OverdueCustomer[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const fontClass = locale === 'ku' ? 'font-kurdish' : 'font-engar'

  useEffect(() => {
    // Fetch all notifications (low stock + overdue customers)
    const fetchNotifications = async () => {
      try {
        const response = await fetch('/api/statistics/notifications')
        if (response.ok) {
          const data = await response.json()
          if (data.items) {
            setLowStockItems(data.items)
          }
          if (data.customers) {
            setOverdueCustomers(data.customers)
          }
        }
      } catch (error) {
        console.error('Error fetching notifications:', error)
      }
    }

    fetchNotifications()
    
    // Refresh every 5 minutes
    const interval = setInterval(fetchNotifications, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const productCount = lowStockItems.filter(item => item.type === 'product').length
  const motorcycleCount = lowStockItems.filter(item => item.type === 'motorcycle').length
  const customerCount = overdueCustomers.length
  const totalCount = lowStockItems.length + customerCount

  const handleViewProducts = () => {
    router.push(`/${locale}/products`)
    setIsOpen(false)
  }

  const handleViewMotorcycles = () => {
    router.push(`/${locale}/motorcycles`)
    setIsOpen(false)
  }

  const handleViewCustomers = () => {
    router.push(`/${locale}/customers`)
    setIsOpen(false)
  }

  const handleViewItem = (item: LowStockItem) => {
    if (item.type === 'product') {
      router.push(`/${locale}/products/${item.id}`)
    } else {
      router.push(`/${locale}/motorcycles/${item.id}`)
    }
    setIsOpen(false)
  }

  const handleViewCustomer = (customer: OverdueCustomer) => {
    router.push(`/${locale}/customers/${customer.id}`)
    setIsOpen(false)
  }

  const formatCurrency = (amount: number, currency: 'IQD' | 'USD' = 'IQD') => {
    if (currency === 'USD') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(amount)
    }
    return `${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ع.د`
  }

  return (
    <div suppressHydrationWarning>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("relative", fontClass)}
        >
          <IconBell className="h-5 w-5" />
          {totalCount > 0 && (
            <Badge
              variant="destructive"
              className={cn(
                "absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs",
                fontClass
              )}
            >
              {totalCount > 9 ? '9+' : totalCount}
            </Badge>
          )}
          <span className="sr-only">{t('title')}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={cn("w-80", fontClass)}>
        <DropdownMenuLabel className={cn("flex items-center justify-between", fontClass)}>
          <span>{t('title')}</span>
          {totalCount > 0 && (
            <Badge variant="destructive" className={cn("text-xs", fontClass)}>
              {totalCount}
            </Badge>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {totalCount === 0 ? (
          <div className={cn("px-2 py-6 text-center text-sm text-muted-foreground", fontClass)}>
            {t('noAlerts')}
          </div>
        ) : (
          <>
            {productCount > 0 && (
              <>
                <DropdownMenuLabel className={cn("text-xs font-normal text-muted-foreground", fontClass)}>
                  {t('products')} ({productCount})
                </DropdownMenuLabel>
                {lowStockItems
                  .filter(item => item.type === 'product')
                  .slice(0, 5)
                  .map((item) => (
                    <DropdownMenuItem
                      key={item.id}
                      onClick={() => handleViewItem(item)}
                      className={cn("cursor-pointer", fontClass)}
                    >
                      <IconPackage className="h-4 w-4 mr-2 text-orange-600" />
                      <div className="flex-1 min-w-0">
                        <div className={cn("text-sm font-medium truncate", fontClass)}>
                          {item.displayName}
                        </div>
                        <div className={cn("text-xs text-muted-foreground", fontClass)}>
                          {t('stock')}: {item.stockQuantity} / {t('threshold')}: {item.lowStockThreshold}
                        </div>
                      </div>
                      <IconAlertTriangle className="h-4 w-4 ml-2 text-orange-600 flex-shrink-0" />
                    </DropdownMenuItem>
                  ))}
                {productCount > 5 && (
                  <DropdownMenuItem
                    onClick={handleViewProducts}
                    className={cn("cursor-pointer text-center justify-center text-xs text-muted-foreground", fontClass)}
                  >
                    {t('viewMoreProducts', { count: productCount - 5, plural: productCount - 5 !== 1 ? 's' : '' })}
                  </DropdownMenuItem>
                )}
                {motorcycleCount > 0 && <DropdownMenuSeparator />}
              </>
            )}

            {motorcycleCount > 0 && (
              <>
                <DropdownMenuLabel className={cn("text-xs font-normal text-muted-foreground", fontClass)}>
                  {t('motorcycles')} ({motorcycleCount})
                </DropdownMenuLabel>
                {lowStockItems
                  .filter(item => item.type === 'motorcycle')
                  .slice(0, 5)
                  .map((item) => (
                    <DropdownMenuItem
                      key={item.id}
                      onClick={() => handleViewItem(item)}
                      className={cn("cursor-pointer", fontClass)}
                    >
                      <IconMotorcycle className="h-4 w-4 mr-2 text-orange-600" />
                      <div className="flex-1 min-w-0">
                        <div className={cn("text-sm font-medium truncate", fontClass)}>
                          {item.displayName}
                        </div>
                        <div className={cn("text-xs text-muted-foreground", fontClass)}>
                          {t('stock')}: {item.stockQuantity} / {t('threshold')}: {item.lowStockThreshold}
                        </div>
                      </div>
                      <IconAlertTriangle className="h-4 w-4 ml-2 text-orange-600 flex-shrink-0" />
                    </DropdownMenuItem>
                  ))}
                {motorcycleCount > 5 && (
                  <DropdownMenuItem
                    onClick={handleViewMotorcycles}
                    className={cn("cursor-pointer text-center justify-center text-xs text-muted-foreground", fontClass)}
                  >
                    {t('viewMoreMotorcycles', { count: motorcycleCount - 5, plural: motorcycleCount - 5 !== 1 ? 's' : '' })}
                  </DropdownMenuItem>
                )}
                {(customerCount > 0) && <DropdownMenuSeparator />}
              </>
            )}

            {customerCount > 0 && (
              <>
                <DropdownMenuLabel className={cn("text-xs font-normal text-muted-foreground", fontClass)}>
                  {t('overduePayments')} ({customerCount})
                </DropdownMenuLabel>
                {overdueCustomers
                  .slice(0, 5)
                  .map((customer) => (
                    <DropdownMenuItem
                      key={customer.id}
                      onClick={() => handleViewCustomer(customer)}
                      className={cn("cursor-pointer", fontClass)}
                    >
                      <IconUsers className="h-4 w-4 mr-2 text-red-600" />
                      <div className="flex-1 min-w-0">
                        <div className={cn("text-sm font-medium truncate", fontClass)}>
                          {customer.name}
                        </div>
                        <div className={cn("text-xs text-muted-foreground", fontClass)}>
                          {t('daysOverdue')}: {customer.daysOverdue} • {t('debt')}: {customer.debtIqd > 0 ? formatCurrency(customer.debtIqd, 'IQD') : formatCurrency(customer.debtUsd, 'USD')}
                        </div>
                      </div>
                      <IconAlertTriangle className="h-4 w-4 ml-2 text-red-600 flex-shrink-0" />
                    </DropdownMenuItem>
                  ))}
                {customerCount > 5 && (
                  <DropdownMenuItem
                    onClick={handleViewCustomers}
                    className={cn("cursor-pointer text-center justify-center text-xs text-muted-foreground", fontClass)}
                  >
                    {t('viewMoreCustomers', { count: customerCount - 5, plural: customerCount - 5 !== 1 ? 's' : '' })}
                  </DropdownMenuItem>
                )}
              </>
            )}

            <DropdownMenuSeparator />
            <div className="flex gap-2 p-2 flex-wrap">
              {productCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleViewProducts}
                  className={cn("flex-1 text-xs h-7 min-w-[120px]", fontClass)}
                >
                  <IconPackage className="h-3 w-3 mr-1" />
                  {t('viewAllProducts')}
                </Button>
              )}
              {motorcycleCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleViewMotorcycles}
                  className={cn("flex-1 text-xs h-7 min-w-[120px]", fontClass)}
                >
                  <IconMotorcycle className="h-3 w-3 mr-1" />
                  {t('viewAllMotorcycles')}
                </Button>
              )}
              {customerCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleViewCustomers}
                  className={cn("flex-1 text-xs h-7 min-w-[120px]", fontClass)}
                >
                  <IconUsers className="h-3 w-3 mr-1" />
                  {t('viewAllCustomers')}
                </Button>
              )}
            </div>
          </>
        )}
      </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

