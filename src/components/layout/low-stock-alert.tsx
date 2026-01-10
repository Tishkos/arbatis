'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { IconAlertTriangle, IconX } from '@tabler/icons-react'
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

export function LowStockAlert() {
  const router = useRouter()
  const params = useParams()
  const locale = (params?.locale as string) || 'en'
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([])
  const [isVisible, setIsVisible] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)
  const fontClass = locale === 'ku' ? 'font-kurdish' : 'font-engar'

  useEffect(() => {
    // Check if alert was dismissed in this session
    const dismissedKey = 'lowStockAlertDismissed'
    const dismissedTimestamp = sessionStorage.getItem(dismissedKey)
    const now = Date.now()
    
    // If dismissed less than 1 hour ago, don't show
    if (dismissedTimestamp && (now - parseInt(dismissedTimestamp)) < 60 * 60 * 1000) {
      setIsDismissed(true)
      return
    }

    // Fetch low stock items
    const fetchLowStock = async () => {
      try {
        const response = await fetch('/api/statistics/low-stock')
        if (response.ok) {
          const data = await response.json()
          if (data.items && data.items.length > 0) {
            setLowStockItems(data.items)
            setIsVisible(true)
          }
        }
      } catch (error) {
        console.error('Error fetching low stock items:', error)
      }
    }

    fetchLowStock()
    
    // Refresh every 5 minutes
    const interval = setInterval(fetchLowStock, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const handleDismiss = () => {
    setIsVisible(false)
    setIsDismissed(true)
    // Store dismissal in sessionStorage with timestamp
    sessionStorage.setItem('lowStockAlertDismissed', Date.now().toString())
  }

  const handleViewProducts = () => {
    router.push(`/${locale}/products`)
  }

  const handleViewMotorcycles = () => {
    router.push(`/${locale}/motorcycles`)
  }

  if (!isVisible || isDismissed || lowStockItems.length === 0) {
    return null
  }

  const productCount = lowStockItems.filter(item => item.type === 'product').length
  const motorcycleCount = lowStockItems.filter(item => item.type === 'motorcycle').length

  return (
    <Alert 
      variant="destructive" 
      className={cn(
        "sticky top-0 z-50 mx-4 mt-4 mb-0 border-orange-500 bg-orange-50 dark:bg-orange-950",
        fontClass
      )}
    >
      <IconAlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <AlertTitle className={cn("text-orange-900 dark:text-orange-100", fontClass)}>
            Low Stock Alert
          </AlertTitle>
          <AlertDescription className={cn("text-orange-800 dark:text-orange-200 mt-1", fontClass)}>
            {lowStockItems.length} item{lowStockItems.length !== 1 ? 's' : ''} 
            {' '}below alert threshold:
            {productCount > 0 && (
              <span className="ml-2">
                {productCount} product{productCount !== 1 ? 's' : ''}
              </span>
            )}
            {motorcycleCount > 0 && (
              <span className="ml-2">
                {motorcycleCount} motorcycle{motorcycleCount !== 1 ? 's' : ''}
              </span>
            )}
            <div className="mt-2 flex gap-2">
              {productCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleViewProducts}
                  className={cn(
                    "h-7 text-xs border-orange-300 text-orange-900 hover:bg-orange-100",
                    fontClass
                  )}
                >
                  View Products
                </Button>
              )}
              {motorcycleCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleViewMotorcycles}
                  className={cn(
                    "h-7 text-xs border-orange-300 text-orange-900 hover:bg-orange-100",
                    fontClass
                  )}
                >
                  View Motorcycles
                </Button>
              )}
            </div>
          </AlertDescription>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDismiss}
          className={cn(
            "h-6 w-6 text-orange-600 hover:text-orange-900 hover:bg-orange-100",
            fontClass
          )}
        >
          <IconX className="h-4 w-4" />
        </Button>
      </div>
    </Alert>
  )
}

