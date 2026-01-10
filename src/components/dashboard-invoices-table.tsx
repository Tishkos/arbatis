"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { getTextDirection } from "@/lib/i18n"
import { format } from 'date-fns'
import {
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
  IconFileInvoice,
} from "@tabler/icons-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

type Invoice = {
  id: string
  invoiceNumber: string
  status: string
  total: number
  invoiceDate: string
  customer: {
    id: string
    name: string
    sku: string
  } | null
  createdBy: {
    id: string
    name: string
    email: string
  } | null
  items?: Array<{
    id?: string
    productId: string | null
    notes: string | null
    product: {
      id?: string
      name: string
      sku?: string
    } | null
  }>
  sale?: {
    type: string
  } | null
  notes?: string | null
}

export function DashboardInvoicesTable({ locale }: { locale: string }) {
  const router = useRouter()
  const t = useTranslations('navigation.dashboardStatistics')
  const tInvoice = useTranslations('navigation.invoicesPage')
  const tSalesActivities = useTranslations('navigation.salesActivities')
  const fontClass = locale === 'ku' ? 'font-kurdish' : 'font-engar'
  const direction = getTextDirection(locale as 'ku' | 'en' | 'ar')
  
  const [invoices, setInvoices] = React.useState<Invoice[]>([])
  const [loading, setLoading] = React.useState(true)
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(10)
  const [total, setTotal] = React.useState(0)

  React.useEffect(() => {
    const fetchInvoices = async () => {
      setLoading(true)
      try {
        const response = await fetch(`/api/invoices?page=${page}&pageSize=${pageSize}&sortBy=invoiceDate&sortOrder=asc&status=`)
        if (response.ok) {
          const data = await response.json()
          // Ensure invoices have the structure we expect
          const processedInvoices = (data.invoices || []).map((inv: any) => ({
            ...inv,
            items: inv.items || [],
            sale: inv.sale || null,
            notes: inv.notes || null,
          }))
          setInvoices(processedInvoices)
          setTotal(data.pagination?.total || 0)
        }
      } catch (error) {
        console.error('Error fetching invoices:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchInvoices()
  }, [page, pageSize])

  const totalPages = Math.ceil(total / pageSize)

  const getStatusLabel = (status: string) => {
    const statusMap: Record<string, string> = {
      'PAID': 'statusPaid',
      'PARTIALLY_PAID': 'statusPartiallyPaid',
      'UNPAID': 'statusUnpaid',
      'DRAFT': 'statusDraft',
      'FINALIZED': 'statusFinalized',
      'CANCELLED': 'statusCancelled',
      'OVERDUE': 'statusOverdue',
    }
    const key = statusMap[status] || status
    const translated = tInvoice(key as any)
    // Check if translation failed (returned the key itself or navigation path)
    if (translated && !translated.startsWith('navigation.') && translated !== key) {
      return translated
    }
    // Fallback to original status if translation not found
    return status.replace('_', ' ')
  }

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'PAID':
        return 'default'
      case 'PARTIALLY_PAID':
        return 'secondary'
      case 'UNPAID':
        return 'destructive'
      case 'DRAFT':
        return 'outline'
      default:
        return 'outline'
    }
  }

  const getInvoiceType = (invoice: Invoice) => {
    // Check if it's a payment invoice (check notes and items)
    if (invoice.notes) {
      const notes = invoice.notes.toUpperCase()
      if (notes.includes('PAYMENT') || notes.includes('PAYMENT INVOICE')) {
        const type = tInvoice('typePayment')
        if (type && !type.startsWith('navigation.')) return type
      }
    }
    
    // Check invoice items for payment markers
    if (invoice.items && invoice.items.length > 0) {
      const hasPayment = invoice.items.some((item) => {
        if (item.notes) {
          const itemNotes = item.notes.toUpperCase().trim()
          if (itemNotes.startsWith('PAYMENT:')) {
            return true
          }
        }
        return false
      })
      if (hasPayment) {
        const type = tInvoice('typePayment')
        if (type && !type.startsWith('navigation.')) return type
      }
    }
    
    // Determine if it's a motorcycle invoice (check notes first, then items)
    let isMotorcycle = false
    
    // Method 1: Check invoice notes
    if (invoice.notes) {
      const notes = invoice.notes.toUpperCase()
      if (notes.includes('[INVOICE_TYPE:') && notes.includes('MOTORCYCLE')) {
        isMotorcycle = true
      }
    }
    
    // Method 2: Check invoice items for motorcycle markers
    if (!isMotorcycle && invoice.items && invoice.items.length > 0) {
      isMotorcycle = invoice.items.some((item: any) => {
        // Primary check: If productId is null and notes exist
        if (!item.productId && item.notes) {
          const notes = item.notes.toUpperCase().trim()
          if (notes.startsWith('MOTORCYCLE:')) {
            return true
          }
        }
        // Secondary check: Check product name
        const productName = item.product?.name?.toLowerCase() || ''
        const itemNotes = item.notes?.toLowerCase() || ''
        return productName.includes('motorcycle') || itemNotes.startsWith('motorcycle:')
      }) || false
    }
    
    // Determine sale type
    const isWholesale = invoice.sale?.type === 'JUMLA'
    const isRetail = invoice.sale?.type === 'MUFRAD'
    
    // Return appropriate type label with fallback
    let typeKey: string | null = null
    if (isWholesale && isMotorcycle) {
      typeKey = 'typeWholesaleMotorcycle'
    } else if (isWholesale) {
      typeKey = 'typeWholesaleProduct'
    } else if (isRetail && isMotorcycle) {
      typeKey = 'typeRetailMotorcycle'
    } else if (isRetail) {
      typeKey = 'typeRetailProduct'
    } else if (isMotorcycle) {
      // Default to retail if sale type not set
      typeKey = 'typeRetailMotorcycle'
    } else {
      // Default to retail product if sale type not set, or use typeUnknown as final fallback
      typeKey = 'typeRetailProduct'
    }
    
    if (typeKey) {
      const type = tInvoice(typeKey as any)
      if (type && !type.startsWith('navigation.')) {
        return type
      }
    }
    
    // Final fallback
    return tInvoice('typeUnknown') || '-'
  }
  
  const getCurrency = (invoice: Invoice): string => {
    // Use same logic as getInvoiceType for consistency
    let isMotorcycle = false
    
    // Check invoice notes
    if (invoice.notes) {
      const notes = invoice.notes.toUpperCase()
      if (notes.includes('[INVOICE_TYPE:') && notes.includes('MOTORCYCLE')) {
        isMotorcycle = true
      }
    }
    
    // Check invoice items
    if (!isMotorcycle && invoice.items && invoice.items.length > 0) {
      isMotorcycle = invoice.items.some((item) => {
        if (!item.productId && item.notes) {
          const notes = item.notes.toUpperCase().trim()
          if (notes.startsWith('MOTORCYCLE:')) {
            return true
          }
        }
        const productName = item.product?.name?.toLowerCase() || ''
        const itemNotes = item.notes?.toLowerCase() || ''
        return productName.includes('motorcycle') || itemNotes.startsWith('motorcycle:')
      }) || false
    }
    
    return isMotorcycle ? 'USD' : 'IQD'
  }

  return (
    <div className={cn("flex flex-col gap-4 px-4 lg:px-6", fontClass)} dir={direction}>
      <div className="flex items-center justify-between">
        <h2 className={cn("text-xl font-semibold", fontClass)}>{t('recentInvoices')}</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push(`/${locale}/invoices`)}
          className={fontClass}
        >
          {t('viewAll')}
        </Button>
      </div>
      
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Spinner />
        </div>
      ) : invoices.length === 0 ? (
        <div className={cn("text-center py-8 text-muted-foreground", fontClass)}>
          {t('noSalesData')}
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={fontClass}>{t('invoiceNumberColumn')}</TableHead>
                  <TableHead className={fontClass}>{t('customerColumn')}</TableHead>
                  <TableHead className={fontClass}>{t('typeColumn')}</TableHead>
                  <TableHead className={fontClass}>{t('dateColumn')}</TableHead>
                  <TableHead className={cn("text-right", fontClass)}>{t('amountColumn')}</TableHead>
                  <TableHead className={fontClass}>{t('statusColumn')}</TableHead>
                  <TableHead className={fontClass}>{t('createdByColumn')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow
                    key={invoice.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/${locale}/invoices/${invoice.id}`)}
                  >
                    <TableCell className={cn("font-medium font-mono", fontClass)}>
                      {invoice.invoiceNumber}
                    </TableCell>
                    <TableCell className={fontClass}>
                      {invoice.customer ? (
                        <div>
                          <div className="font-medium">{invoice.customer.name}</div>
                          <div className="text-sm text-muted-foreground">({invoice.customer.sku})</div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className={fontClass}>
                      {getInvoiceType(invoice)}
                    </TableCell>
                    <TableCell className={fontClass}>
                      {format(new Date(invoice.invoiceDate), 'PP')}
                    </TableCell>
                    <TableCell className={cn("text-right font-medium", fontClass)}>
                      {(() => {
                        const currency = getCurrency(invoice)
                        return currency === 'USD' ? '$' : 'ع.د '
                      })()}
                      {Number(invoice.total).toLocaleString('en-US', { 
                        minimumFractionDigits: getCurrency(invoice) === 'USD' ? 2 : 0,
                        maximumFractionDigits: getCurrency(invoice) === 'USD' ? 2 : 0
                      })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(invoice.status)} className={fontClass}>
                        {getStatusLabel(invoice.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className={fontClass}>
                      {invoice.createdBy?.name || tSalesActivities('unknown') || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          <div className="flex items-center justify-between">
            <div className={cn("text-muted-foreground text-sm hidden lg:flex", fontClass)}>
              {t('page')} {page} {t('of')} {totalPages}
            </div>
            <div className="flex w-full items-center gap-8 lg:w-fit">
              <div className="hidden items-center gap-2 lg:flex">
                <Label htmlFor="rows-per-page" className={cn("text-sm font-medium", fontClass)}>
                  {t('rowsPerPage')}
                </Label>
                <Select
                  value={`${pageSize}`}
                  onValueChange={(value) => {
                    setPageSize(Number(value))
                    setPage(1)
                  }}
                >
                  <SelectTrigger size="sm" className="w-20" id="rows-per-page">
                    <SelectValue placeholder={pageSize} />
                  </SelectTrigger>
                  <SelectContent side="top">
                    {[10, 20, 30, 40, 50].map((size) => (
                      <SelectItem key={size} value={`${size}`}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className={cn("flex w-fit items-center justify-center text-sm font-medium", fontClass)}>
                {t('page')} {page} {t('of')} {totalPages}
              </div>
              <div className="ml-auto flex items-center gap-2 lg:ml-0">
                <Button
                  variant="outline"
                  className="hidden h-8 w-8 p-0 lg:flex"
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                >
                  <span className="sr-only">{t('goToFirstPage')}</span>
                  <IconChevronsLeft />
                </Button>
                <Button
                  variant="outline"
                  className="size-8"
                  size="icon"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <span className="sr-only">{t('goToPreviousPage')}</span>
                  <IconChevronLeft />
                </Button>
                <Button
                  variant="outline"
                  className="size-8"
                  size="icon"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  <span className="sr-only">{t('goToNextPage')}</span>
                  <IconChevronRight />
                </Button>
                <Button
                  variant="outline"
                  className="hidden size-8 lg:flex"
                  size="icon"
                  onClick={() => setPage(totalPages)}
                  disabled={page >= totalPages}
                >
                  <span className="sr-only">{t('goToLastPage')}</span>
                  <IconChevronsRight />
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

