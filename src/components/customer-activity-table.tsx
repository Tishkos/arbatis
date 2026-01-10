"use client"

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { format } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnSizingState,
} from '@tanstack/react-table'
import { cn } from '@/lib/utils'

type ActivityData = {
  type: 'sale' | 'invoice' | 'payment' | 'balance'
  id: string
  date: string
  amount: number
  description: string | null
  reference: string | null
  currency?: 'USD' | 'IQD' // Add currency to track invoice type
}

export function CustomerActivityTable({
  customerId,
  fontClass,
  locale
}: {
  customerId: string
  fontClass: string
  locale: string
}) {
  const t = useTranslations('customers.detail.activityTable')
  const [activities, setActivities] = useState<ActivityData[]>([])
  const [loading, setLoading] = useState(true)
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({})

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch(`/api/customers/${customerId}/invoices?page=1&pageSize=100`).then(res => res.json()).catch(() => ({ invoices: [] })),
      fetch(`/api/customers/${customerId}/payments`).then(res => res.json()).catch(() => ({ payments: [] })),
      fetch(`/api/customers/${customerId}/balance`).then(res => res.json()).catch(() => ({ history: [] }))
    ]).then(([invoicesData, paymentsData, balanceData]) => {
      const data: ActivityData[] = []
      
      // Add invoices
      if (invoicesData.invoices) {
        invoicesData.invoices.forEach((invoice: any) => {
          // Determine if it's a motorcycle invoice (USD) or product invoice (IQD)
          // Motorcycles have productId: null and notes starting with "MOTORCYCLE:"
          const isMotorcycle = invoice.items?.some((item: any) => {
            if (!item.productId && item.notes) {
              const notes = item.notes.toUpperCase()
              return notes.startsWith('MOTORCYCLE:')
            }
            const productName = item.product?.name?.toLowerCase() || ''
            const notes = item.notes?.toLowerCase() || ''
            return productName.includes('motorcycle') || notes.startsWith('motorcycle:')
          }) || false
          
          data.push({
            type: 'invoice',
            id: invoice.id,
            date: invoice.invoiceDate || invoice.createdAt,
            amount: Number(invoice.total),
            description: t('invoiceForCustomer', { 
              name: invoice.customer?.name || t('customer'), 
              sku: invoice.customer?.sku || t('nA') 
            }),
            reference: invoice.invoiceNumber,
            currency: isMotorcycle ? 'USD' : 'IQD'
          })
        })
      }
      
      // Add payments
      if (paymentsData.payments) {
        paymentsData.payments.forEach((payment: any) => {
          // Determine currency: if amountUsd > 0, it's USD, otherwise IQD
          const hasUsd = Number(payment.amountUsd || 0) > 0
          const hasIqd = Number(payment.amountIqd || 0) > 0
          const currency = hasUsd ? 'USD' : 'IQD'
          const amount = hasUsd ? Number(payment.amountUsd || 0) : Number(payment.amountIqd || 0)
          
          data.push({
            type: 'payment',
            id: payment.id,
            date: payment.date,
            amount: -amount, // Negative for payments
            description: payment.description || 'Payment',
            reference: payment.id,
            currency: currency
          })
        })
      }
      
      // Add balance changes
      if (balanceData.history) {
        balanceData.history.forEach((item: any) => {
          if (item.type === 'invoice' || item.type === 'payment') {
            // Already added above
            return
          }
          data.push({
            type: 'balance',
            id: item.id,
            date: item.date,
            amount: Number(item.amount),
            description: item.description || 'Balance adjustment',
            reference: item.reference
          })
        })
      }
      
      // Sort by date descending
      data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      setActivities(data)
    }).catch(console.error).finally(() => setLoading(false))
  }, [customerId])

  const columns: ColumnDef<ActivityData>[] = [
    {
      accessorKey: 'type',
      header: t('type'),
      size: 120,
      minSize: 100,
      maxSize: 150,
      cell: ({ row }) => {
        const type = row.original.type
        const colors = {
          sale: 'bg-blue-100 text-blue-800',
          invoice: 'bg-green-100 text-green-800',
          payment: 'bg-purple-100 text-purple-800',
          balance: 'bg-orange-100 text-orange-800'
        }
        return (
          <Badge className={cn(colors[type] || 'bg-gray-100 text-gray-800', fontClass)}>
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </Badge>
        )
      },
    },
    {
      accessorKey: 'date',
      header: t('date'),
      size: 150,
      minSize: 120,
      maxSize: 200,
      cell: ({ row }) => (
        <span className={cn("text-sm", fontClass)}>
          {format(new Date(row.original.date), 'PPp')}
        </span>
      ),
    },
    {
      accessorKey: 'description',
      header: t('description'),
      size: 250,
      minSize: 200,
      maxSize: 400,
      cell: ({ row }) => (
        <span className={cn("text-sm", fontClass)}>
          {row.original.description || '-'}
        </span>
      ),
    },
    {
      accessorKey: 'reference',
      header: t('reference'),
      size: 150,
      minSize: 120,
      maxSize: 250,
      cell: ({ row }) => (
        <span className={cn("text-sm text-muted-foreground font-mono", fontClass)}>
          {row.original.reference || '-'}
        </span>
      ),
    },
    {
      accessorKey: 'amount',
      header: () => <div className={cn("text-right", fontClass)}>{t('amount')}</div>,
      size: 130,
      minSize: 110,
      maxSize: 200,
      cell: ({ row }) => {
        const amount = row.original.amount
        const isCredit = amount < 0
        // Determine currency: USD for motorcycle invoices, IQD for product invoices
        // For payments, check if it's USD or IQD based on the payment data
        const currency = row.original.currency || 'IQD' // Default to IQD if not specified
        const currencySymbol = currency === 'USD' ? '$' : 'ع.د '
        
        return (
          <div className={cn("text-right font-medium", isCredit ? "text-green-600" : "text-red-600", fontClass)}>
            {isCredit ? '-' : '+'}{currencySymbol}{Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: currency === 'USD' ? 2 : 0, maximumFractionDigits: 2 })}
          </div>
        )
      },
    },
  ]

  const table = useReactTable({
    data: activities,
    columns,
    getCoreRowModel: getCoreRowModel(),
    state: {
      columnSizing,
    },
    onColumnSizingChange: setColumnSizing,
    columnResizeMode: 'onChange',
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner />
      </div>
    )
  }

  if (activities.length === 0) {
    return (
      <div className={cn("text-center py-8 text-muted-foreground", fontClass)}>
        {t('noActivities')}
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className={fontClass}
                  style={{ width: header.getSize() }}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                  {header.column.getCanResize() && (
                    <div
                      onMouseDown={header.getResizeHandler()}
                      onTouchStart={header.getResizeHandler()}
                      className={cn(
                        "absolute right-0 top-0 h-full w-1 cursor-col-resize touch-none select-none bg-border opacity-0 transition-opacity hover:opacity-100",
                        header.column.getIsResizing() && "opacity-100"
                      )}
                    />
                  )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell
                  key={cell.id}
                  className={fontClass}
                  style={{ width: cell.column.getSize() }}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

