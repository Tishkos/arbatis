"use client"

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { getTextDirection } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { IconArrowLeft, IconCalendar, IconUser, IconEdit, IconTrash, IconAlertCircle, IconCurrencyDollar, IconSearch, IconChevronLeft, IconChevronRight, IconChevronsLeft, IconChevronsRight, IconPrinter, IconPaperclip, IconExternalLink, IconPlus, IconX } from '@tabler/icons-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { useState, useEffect, useCallback, useRef } from 'react'
import { CustomerDialog } from './customer-dialog'
import { DeleteCustomerDialog } from './delete-customer-dialog'
import { CustomerActivityTable } from './customer-activity-table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog-animated'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Spinner } from '@/components/ui/spinner'

type Customer = {
  id: string
  name: string
  sku: string
  phone: string | null
  email: string | null
  image: string | null
  attachment: string | null
  debtIqd: number
  debtUsd: number
  currentBalance: number
  daysOverdue: number
  lastPaymentDate: Date | string | null
  addressId: string | null
  address: {
    id: string
    name: string
  } | null
  notes: string | null
  notificationDays: number | null
  notificationType: string | null
  createdAt: Date | string
  updatedAt: Date | string
  createdBy: {
    id: string
    name: string | null
    email: string
  } | null
}

interface CustomerDetailProps {
  customer: Customer
  locale: string
}

type PaymentData = {
  id: string
  date: string
  amountIqd: number
  amountUsd: number
  amountMotorcycle: number
  description: string | null
  paymentMethod: string | null
  invoiceNumber: string | null
  createdBy: {
    name: string | null
    email: string
  } | null
}

type BalanceData = {
  id: string
  date: string
  amount: number
  balance: number
  description: string | null
  type: 'payment' | 'invoice' | 'sale' | 'adjustment'
  reference: string | null
  invoice: {
    id: string
    invoiceNumber: string
    total: number
    amountPaid: number
    amountDue: number
    status: string
    invoiceDate: string
  } | null
}

// Helper function to determine if an invoice is for motorcycles
const isMotorcycleInvoice = (invoice: any): boolean => {
  // Method 1: Check invoice notes for invoice type
  if (invoice.notes) {
    const notes = invoice.notes.toUpperCase()
    if (notes.includes('[INVOICE_TYPE:') && notes.includes('MOTORCYCLE')) {
      return true
    }
  }
  
  // Method 2: Check invoice items for motorcycle markers
  if (invoice.items && invoice.items.length > 0) {
    const hasMotorcycle = invoice.items.some((item: any) => {
      // Primary check: If productId is null and notes exist, check if it's a motorcycle
      if (!item.productId && item.notes) {
        const notes = item.notes.toUpperCase().trim()
        if (notes.startsWith('MOTORCYCLE:')) {
          return true
        }
      }
      // Secondary check: Check product name and notes
      const productName = item.product?.name?.toLowerCase() || ''
      const itemNotes = item.notes?.toLowerCase() || ''
      return productName.includes('motorcycle') || itemNotes.startsWith('motorcycle:')
    })
    if (hasMotorcycle) {
      return true
    }
  }
  
  // Method 3: Check sale type (if available)
  if (invoice.sale?.type === 'MUFRAD' && invoice.items?.some((item: any) => !item.productId)) {
    // Retail invoices with null productId items are likely motorcycles
    return true
  }
  
  // Method 4: Check if all items have null productId (likely motorcycles)
  if (invoice.items && invoice.items.length > 0) {
    const allNullProductId = invoice.items.every((item: any) => !item.productId)
    if (allNullProductId && invoice.items.some((item: any) => item.notes)) {
      return true
    }
  }
  
  return false
}

export function CustomerDetail({ customer, locale }: CustomerDetailProps) {
  const router = useRouter()
  const t = useTranslations('customers')
  const fontClass = locale === 'ku' ? 'font-kurdish' : 'font-engar'
  const direction = getTextDirection(locale as 'ku' | 'en' | 'ar')
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [payments, setPayments] = useState<PaymentData[]>([])
  const [balanceHistory, setBalanceHistory] = useState<BalanceData[]>([])
  const [loadingPayments, setLoadingPayments] = useState(true)
  const [loadingBalance, setLoadingBalance] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({})
  const [addresses, setAddresses] = useState<{ id: string; name: string }[]>([])
  const [isUploadingAttachments, setIsUploadingAttachments] = useState(false)
  const attachmentInputRef = useRef<HTMLInputElement>(null)
  
  // Invoices state
  const [invoices, setInvoices] = useState<any[]>([])
  const [loadingInvoices, setLoadingInvoices] = useState(true)
  const [invoiceSearch, setInvoiceSearch] = useState('')
  const [invoicePage, setInvoicePage] = useState(1)
  const [invoicePageSize, setInvoicePageSize] = useState(20)
  const [invoicePaginationMeta, setInvoicePaginationMeta] = useState({
    total: 0,
    totalPages: 0,
  })
  const [invoiceSortBy, setInvoiceSortBy] = useState('invoiceDate')
  const [invoiceSortOrder, setInvoiceSortOrder] = useState<'asc' | 'desc'>('desc')
  
  // Payment form state
  const [paymentAmountIqd, setPaymentAmountIqd] = useState('')
  const [paymentAmountUsd, setPaymentAmountUsd] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [paymentDescription, setPaymentDescription] = useState('')
  const [isProcessingPayment, setIsProcessingPayment] = useState(false)

  // Fetch payments
  useEffect(() => {
    setLoadingPayments(true)
    fetch(`/api/customers/${customer.id}/payments`)
      .then(async res => {
        if (!res.ok) {
          // Try to get error message from response
          let errorMessage = 'Failed to fetch payments'
          try {
            const errorData = await res.json()
            errorMessage = errorData.error || errorMessage
          } catch {
            // If response is not JSON, use status text
            errorMessage = res.statusText || errorMessage
          }
          console.error(`Payments API error (${res.status}):`, errorMessage)
          throw new Error(errorMessage)
        }
        return res.json()
      })
      .then(data => {
        if (data.payments && Array.isArray(data.payments)) {
          setPayments(data.payments)
        } else {
          setPayments([])
        }
      })
      .catch((error) => {
        console.error('Error fetching payments:', error)
        setPayments([])
      })
      .finally(() => setLoadingPayments(false))
  }, [customer.id])

  // Fetch balance history
  useEffect(() => {
    setLoadingBalance(true)
    fetch(`/api/customers/${customer.id}/balance`)
      .then(res => res.json())
      .then(data => {
        if (data.history) {
          setBalanceHistory(data.history)
        }
      })
      .catch(console.error)
      .finally(() => setLoadingBalance(false))
  }, [customer.id])

  // Fetch addresses
  useEffect(() => {
    fetch("/api/addresses")
      .then((res) => res.json())
      .then((data) => {
        if (data.addresses) {
          setAddresses(data.addresses)
        }
      })
      .catch(console.error)
  }, [])

  // Fetch invoices
  const fetchInvoices = useCallback(() => {
    setLoadingInvoices(true)
    const params = new URLSearchParams({
      page: invoicePage.toString(),
      pageSize: invoicePageSize.toString(),
      sortBy: invoiceSortBy,
      sortOrder: invoiceSortOrder,
    })
    if (invoiceSearch) {
      params.append('search', invoiceSearch)
    }
    
    fetch(`/api/customers/${customer.id}/invoices?${params}`)
      .then(res => res.json())
      .then(data => {
        if (data.invoices) {
          setInvoices(data.invoices)
        }
        if (data.pagination) {
          setInvoicePaginationMeta(data.pagination)
        }
      })
      .catch(console.error)
      .finally(() => setLoadingInvoices(false))
  }, [customer.id, invoicePage, invoicePageSize, invoiceSearch, invoiceSortBy, invoiceSortOrder])

  useEffect(() => {
    fetchInvoices()
  }, [fetchInvoices])

  const initials = customer.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'CU'

  const handleEditSuccess = () => {
    router.refresh()
    setIsEditDialogOpen(false)
  }

  const handleDeleteSuccess = () => {
    router.push(`/${locale}/customers`)
  }

  const handleAttachmentChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    setIsUploadingAttachments(true)
    try {
      // Validate file sizes
      const validFiles: File[] = []
      for (const file of files) {
        if (file.size > 10 * 1024 * 1024) {
          alert(`File "${file.name}" exceeds 10MB limit`)
          continue
        }
        validFiles.push(file)
      }

      if (validFiles.length === 0) {
        setIsUploadingAttachments(false)
        return
      }

      // Get existing attachments
      const parseAttachments = () => {
        if (!customer.attachment) return []
        try {
          const parsed = JSON.parse(customer.attachment)
          if (Array.isArray(parsed)) {
            return parsed.map((item: string | { url: string; name: string; type: string }) => {
              if (typeof item === 'string') return item
              return item.url
            })
          }
        } catch {
          if (typeof customer.attachment === 'string') {
            return [customer.attachment]
          }
        }
        return []
      }

      const existingAttachments = parseAttachments()

      // Create FormData with existing customer data and new attachments
      const formData = new FormData()
      formData.append('name', customer.name)
      formData.append('sku', customer.sku)
      formData.append('type', (customer as any).type || 'INDIVIDUAL')
      if (customer.phone) formData.append('phone', customer.phone)
      if (customer.email) formData.append('email', customer.email)
      if (customer.addressId) formData.append('addressId', customer.addressId)
      formData.append('debtIqd', String(customer.debtIqd))
      formData.append('debtUsd', String(customer.debtUsd))
      if (customer.notes) formData.append('notes', customer.notes)
      if (customer.image) formData.append('existingImage', customer.image)

      // Append new attachments
      validFiles.forEach((file) => {
        formData.append('attachments', file)
      })

      // Append existing attachments to keep
      if (existingAttachments.length > 0) {
        formData.append('existingAttachments', JSON.stringify(existingAttachments))
      }

      const response = await fetch(`/api/customers/${customer.id}`, {
        method: 'PUT',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload attachments')
      }

      // Refresh the page to show new attachments
      router.refresh()
    } catch (error: any) {
      console.error('Error uploading attachments:', error)
      alert(error.message || 'Failed to upload attachments')
    } finally {
      setIsUploadingAttachments(false)
      // Reset input
      if (attachmentInputRef.current) {
        attachmentInputRef.current.value = ''
      }
    }
  }

  const handlePayment = async () => {
    setIsProcessingPayment(true)
    try {
      const response = await fetch(`/api/customers/${customer.id}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amountIqd: parseFloat(paymentAmountIqd || '0'),
          amountUsd: parseFloat(paymentAmountUsd || '0'),
          paymentMethod: paymentMethod || 'CASH',
          description: paymentDescription || null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        const errorMessage = data.error || 'Failed to process payment'
        // Show error message (validation or other errors)
        if (errorMessage.includes('amount') || errorMessage.includes('بڕ')) {
          alert(t('detail.paymentDialog.enterAmount') || errorMessage)
        } else {
          alert(errorMessage)
        }
        throw new Error(errorMessage)
      }

      // If invoice was created, open it for printing
      if (data.invoiceId) {
        // Open invoice in new tab for printing
        setTimeout(() => {
          window.open(`/${locale}/invoices/${data.invoiceId}?print=true`, '_blank')
        }, 500)
      }

      // Reset form
      setPaymentAmountIqd('')
      setPaymentAmountUsd('')
      setPaymentMethod('')
      setPaymentDescription('')
      setIsPaymentDialogOpen(false)
      
      // Refresh data
      router.refresh()
      // Reload payments and balance
      setLoadingPayments(true)
      fetch(`/api/customers/${customer.id}/payments`)
        .then(res => {
          if (!res.ok) {
            throw new Error('Failed to fetch payments')
          }
          return res.json()
        })
        .then(data => {
          if (data.payments && Array.isArray(data.payments)) {
            setPayments(data.payments)
          } else {
            setPayments([])
          }
        })
        .catch((error) => {
          console.error('Error fetching payments:', error)
          setPayments([])
        })
        .finally(() => setLoadingPayments(false))
      fetch(`/api/customers/${customer.id}/balance`)
        .then(res => res.json())
        .then(data => {
          if (data.history) {
            setBalanceHistory(data.history)
          }
        })
    } catch (error) {
      console.error('Error processing payment:', error)
      alert(error instanceof Error ? error.message : 'Failed to process payment')
    } finally {
      setIsProcessingPayment(false)
    }
  }

  const handlePrintPaymentReceipt = () => {
    if (!paymentAmountIqd && !paymentAmountUsd) {
      alert(t('detail.paymentDialog.enterAmount') || 'Please enter payment amounts before printing')
      return
    }

    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const currentDate = format(new Date(), 'PPpp')
    const totalIqd = parseFloat(paymentAmountIqd || '0')
    const totalUsd = parseFloat(paymentAmountUsd || '0')
    
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Payment Receipt - ${customer.name}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 20px;
              direction: ${direction};
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              border-bottom: 2px solid #000;
              padding-bottom: 20px;
            }
            .header h1 {
              margin: 0;
              font-size: 24px;
            }
            .header p {
              margin: 5px 0;
              color: #666;
            }
            .info {
              margin-bottom: 20px;
            }
            .info-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 10px;
              padding: 8px 0;
              border-bottom: 1px solid #eee;
            }
            .info-row:last-child {
              border-bottom: 2px solid #000;
              font-weight: bold;
              font-size: 18px;
            }
            .footer {
              margin-top: 30px;
              padding-top: 20px;
              border-top: 2px solid #000;
              text-align: center;
              color: #666;
            }
            .section {
              margin-bottom: 20px;
            }
            .section-title {
              font-weight: bold;
              font-size: 16px;
              margin-bottom: 10px;
              border-bottom: 1px solid #ddd;
              padding-bottom: 5px;
            }
            .negative {
              color: #388e3c;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Payment Receipt</h1>
            <p><strong>Date:</strong> ${currentDate}</p>
          </div>
          
          <div class="section">
            <div class="section-title">Customer Information</div>
            <div class="info-row">
              <span><strong>Name:</strong></span>
              <span>${customer.name}</span>
            </div>
            <div class="info-row">
              <span><strong>${t('columns.code')}:</strong></span>
              <span>${customer.sku}</span>
            </div>
            ${customer.phone ? `
            <div class="info-row">
              <span><strong>Phone:</strong></span>
              <span>${customer.phone}</span>
            </div>
            ` : ''}
            ${customer.email ? `
            <div class="info-row">
              <span><strong>Email:</strong></span>
              <span>${customer.email}</span>
            </div>
            ` : ''}
          </div>

          <div class="section">
            <div class="section-title">Payment Details</div>
            ${totalIqd > 0 ? `
            <div class="info-row">
              <span><strong>${t('detail.paymentDialog.amountIqd')}:</strong></span>
              <span>${totalIqd.toLocaleString()} ع.د</span>
            </div>
            ` : ''}
            ${totalUsd > 0 ? `
            <div class="info-row">
              <span><strong>Amount USD:</strong></span>
              <span>$${totalUsd.toLocaleString()}</span>
            </div>
            ` : ''}
            <div class="info-row">
              <span><strong>Payment Method:</strong></span>
              <span>${paymentMethod || 'CASH'}</span>
            </div>
            ${paymentDescription ? `
            <div class="info-row">
              <span><strong>Description:</strong></span>
              <span>${paymentDescription}</span>
            </div>
            ` : ''}
          </div>

          <div class="section">
            <div class="section-title">Customer Balance</div>
            <div class="info-row">
              <span><strong>Previous Balance:</strong></span>
              <span>$${customer.currentBalance.toLocaleString()}</span>
            </div>
            <div class="info-row">
              <span><strong>Payment Amount:</strong></span>
              <span class="negative">-$${totalUsd.toLocaleString()}</span>
            </div>
            <div class="info-row">
              <span><strong>New Balance:</strong></span>
              <span>$${(customer.currentBalance - totalUsd).toLocaleString()}</span>
            </div>
          </div>

          <div class="footer">
            <p>Generated on ${currentDate}</p>
            <p>This is a payment receipt. Please keep for your records.</p>
          </div>
        </body>
      </html>
    `
    
    printWindow.document.write(printContent)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
    }, 250)
  }

  const handlePrintInvoices = async () => {
    // Print all invoices with table
    try {
      const invoicesResponse = await fetch(`/api/customers/${customer.id}/invoices?page=1&pageSize=1000&sortBy=invoiceDate&sortOrder=asc`)
      const invoicesData = await invoicesResponse.json()
      const allInvoices = invoicesData.invoices || []

      const printWindow = window.open('', '_blank')
      if (!printWindow) return

      const currentDate = format(new Date(), 'PPpp')
      const isRTL = direction === 'rtl'
      const dir = isRTL ? 'rtl' : 'ltr'

      // Helper to determine if invoice is motorcycle (USD) or product (IQD)
      const isMotorcycleInvoice = (invoice: any): boolean => {
        return invoice.items?.some((item: any) => {
          if (!item.product && item.notes) {
            const notes = item.notes.toUpperCase()
            return notes.startsWith('MOTORCYCLE:')
          }
          const productName = item.product?.name?.toLowerCase() || ''
          const notes = item.notes?.toLowerCase() || ''
          return productName.includes('motorcycle') || notes.startsWith('motorcycle:')
        }) || false
      }

      // Escape HTML
      const escapeHtml = (text: string) => {
        const div = document.createElement('div')
        div.textContent = text
        return div.innerHTML
      }

      const printContent = `
<!DOCTYPE html>
<html lang="${locale}" dir="${dir}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(t('detail.invoices'))} - ${escapeHtml(customer.name)}</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 1cm;
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    @font-face {
      font-family: 'Kurdish';
      src: url('/assets/fonts/ku.ttf') format('truetype');
      font-display: swap;
    }
    
    body {
      font-family: 'Kurdish', 'Arial Unicode MS', Arial, sans-serif;
      direction: ${dir};
      padding: 20px;
      font-size: 9pt;
      color: #000;
    }
    
    .header {
      text-align: center;
      margin-bottom: 20px;
      border-bottom: 2px solid #000;
      padding-bottom: 15px;
    }
    
    .header h1 {
      font-size: 18pt;
      font-weight: bold;
      margin-bottom: 10px;
      color: #000;
    }
    
    .header-info {
      font-size: 8pt;
      color: #666;
      margin-top: 5px;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 15px;
      table-layout: auto;
      word-wrap: break-word;
      page-break-inside: auto;
    }
    
    thead {
      display: table-header-group;
      background-color: #424242;
      color: #FFFFFF;
    }
    
    th {
      padding: 8px;
      text-align: ${isRTL ? 'right' : 'left'};
      border: 1px solid #C8C8C8;
      font-weight: bold;
      font-size: 8pt;
      vertical-align: middle;
    }
    
    tbody {
      display: table-row-group;
    }
    
    tr {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    
    td {
      padding: 6px;
      border: 1px solid #C8C8C8;
      vertical-align: middle;
      font-size: 8pt;
    }
    
    .text-right {
      text-align: right;
    }
    
    .text-center {
      text-align: center;
    }
    
    .footer {
      margin-top: 20px;
      padding-top: 15px;
      border-top: 1px solid #000;
      text-align: center;
      font-size: 8pt;
      color: #666;
    }
    
    @media print {
      body {
        padding: 0;
      }
      
      .no-print {
        display: none;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${escapeHtml(t('detail.invoices'))}</h1>
    <div class="header-info">
      <div><strong>${escapeHtml(t('columns.name'))}:</strong> ${escapeHtml(customer.name)}</div>
      <div><strong>${escapeHtml(t('columns.code'))}:</strong> ${escapeHtml(customer.sku)}</div>
      <div><strong>${escapeHtml(t('detail.date'))}:</strong> ${currentDate}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>${escapeHtml(t('detail.balanceTable.type'))}</th>
        <th>${escapeHtml(t('detail.invoiceNumber'))}</th>
        <th>${escapeHtml(t('detail.date'))}</th>
        <th class="text-right">${escapeHtml(t('detail.total'))}</th>
        <th class="text-right">${escapeHtml(t('detail.paid'))}</th>
        <th class="text-right">${escapeHtml(t('detail.due'))}</th>
        <th>${escapeHtml(t('detail.status'))}</th>
      </tr>
    </thead>
    <tbody>
      ${allInvoices.length > 0 ? allInvoices.map((invoice: any) => {
        const isMotorcycle = isMotorcycleInvoice(invoice)
        const currencySymbol = isMotorcycle ? '$' : 'ع.د '
        const isPaymentInvoice = (() => {
          if (invoice.notes) {
            const notes = invoice.notes.toUpperCase()
            if (notes.includes('PAYMENT') || notes.includes('PAYMENT INVOICE')) {
              return true
            }
          }
          if (invoice.items && invoice.items.length > 0) {
            return invoice.items.some((item: any) => {
              if (item.notes) {
                const itemNotes = item.notes.toUpperCase().trim()
                if (itemNotes.startsWith('PAYMENT:')) {
                  return true
                }
              }
              return false
            })
          }
          return false
        })()
        const invoiceType = isPaymentInvoice ? (t('detail.balanceTable.typePayment') || 'Payment') : (t('detail.balanceTable.typeInvoice') || 'Invoice')
        
        const getTranslatedStatus = (status: string) => {
          switch (status) {
            case 'PAID': return t('detail.statusPaid')
            case 'PARTIALLY_PAID': return t('detail.statusPartiallyPaid')
            case 'OVERDUE': return t('detail.statusOverdue')
            case 'UNPAID': return t('detail.statusUnpaid')
            case 'FINALIZED': return t('detail.statusFinalized') || 'FINALIZED'
            default: return status
          }
        }
        
        let displayStatus = invoice.status
        if (invoice.amountPaid === 0 && invoice.amountDue > 0) {
          displayStatus = 'UNPAID'
        }
        
        return `
          <tr>
            <td>${escapeHtml(invoiceType)}</td>
            <td>${escapeHtml(invoice.invoiceNumber)}</td>
            <td>${escapeHtml(format(new Date(invoice.invoiceDate), 'PP'))}</td>
            <td class="text-right">${currencySymbol}${Math.round(invoice.total).toLocaleString('en-US')}</td>
            <td class="text-right">${currencySymbol}${Math.round(invoice.amountPaid).toLocaleString('en-US')}</td>
            <td class="text-right">${currencySymbol}${Math.round(invoice.amountDue).toLocaleString('en-US')}</td>
            <td>${escapeHtml(getTranslatedStatus(displayStatus))}</td>
          </tr>
        `
      }).join('') : `
        <tr>
          <td colspan="7" class="text-center">${escapeHtml(t('detail.noInvoicesFound'))}</td>
        </tr>
      `}
    </tbody>
  </table>
  
  <div class="footer">
    <p>${escapeHtml(t('detail.invoices'))} - ${escapeHtml(customer.name)}</p>
    <p>${currentDate}</p>
  </div>
  
  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 250);
    };
  </script>
</body>
</html>
      `
      
      printWindow.document.write(printContent)
      printWindow.document.close()
      printWindow.focus()
    } catch (error) {
      console.error('Error generating invoices print:', error)
      alert('Failed to generate invoices print. Please try again.')
    }
  }

  const handlePrintBalance = async () => {
    // Generate balance print (summary only, no invoices)
    try {

      const printWindow = window.open('', '_blank')
      if (!printWindow) return

      const currentDate = format(new Date(), 'PPpp')
      const isRTL = direction === 'rtl'
      const dir = isRTL ? 'rtl' : 'ltr'
      
      // Helper to determine if invoice is motorcycle (USD) or product (IQD)
      const isMotorcycleInvoice = (invoice: any): boolean => {
        return invoice.items?.some((item: any) => {
          if (!item.product && item.notes) {
            const notes = item.notes.toUpperCase()
            return notes.startsWith('MOTORCYCLE:')
          }
          const productName = item.product?.name?.toLowerCase() || ''
          const notes = item.notes?.toLowerCase() || ''
          return productName.includes('motorcycle') || notes.startsWith('motorcycle:')
        }) || false
      }

      // Escape HTML
      const escapeHtml = (text: string) => {
        const div = document.createElement('div')
        div.textContent = text
        return div.innerHTML
      }

      // Get last payment date - use customer.lastPaymentDate if available, otherwise check payments
      const lastPaymentDate = customer.lastPaymentDate
        ? format(new Date(customer.lastPaymentDate), 'PPpp')
        : payments.length > 0
        ? format(new Date(payments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].date), 'PPpp')
        : t('detail.balanceTable.noHistory')

      const printContent = `
<!DOCTYPE html>
<html lang="${locale}" dir="${dir}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(t('detail.balanceStatement'))} - ${escapeHtml(customer.name)}</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 1cm;
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    @font-face {
      font-family: 'Kurdish';
      src: url('/assets/fonts/ku.ttf') format('truetype');
      font-display: swap;
    }
    
    body {
      font-family: 'Kurdish', 'Arial Unicode MS', Arial, sans-serif;
      direction: ${dir};
      padding: 20px;
      font-size: 9pt;
      color: #000;
    }
    
    .header {
      text-align: center;
      margin-bottom: 20px;
      border-bottom: 2px solid #000;
      padding-bottom: 15px;
    }
    
    .header h1 {
      font-size: 18pt;
      font-weight: bold;
      margin-bottom: 10px;
      color: #000;
    }
    
    .header-info {
      font-size: 8pt;
      color: #666;
      margin-top: 5px;
    }
    
    .summary {
      margin-bottom: 20px;
      padding: 15px;
      background-color: #f5f5f5;
      border: 1px solid #ddd;
      border-radius: 4px;
    }
    
    .summary-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 9pt;
    }
    
    .summary-row:last-child {
      margin-bottom: 0;
      padding-top: 8px;
      border-top: 1px solid #ddd;
      font-weight: bold;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 15px;
      table-layout: auto;
      word-wrap: break-word;
      page-break-inside: auto;
    }
    
    thead {
      display: table-header-group;
      background-color: #424242;
      color: #FFFFFF;
    }
    
    th {
      padding: 8px;
      text-align: ${isRTL ? 'right' : 'left'};
      border: 1px solid #C8C8C8;
      font-weight: bold;
      font-size: 8pt;
      vertical-align: middle;
    }
    
    tbody {
      display: table-row-group;
    }
    
    tr {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    
    td {
      padding: 6px;
      border: 1px solid #C8C8C8;
      vertical-align: middle;
      font-size: 8pt;
    }
    
    .text-right {
      text-align: right;
    }
    
    .text-center {
      text-align: center;
    }
    
    .footer {
      margin-top: 20px;
      padding-top: 15px;
      border-top: 1px solid #000;
      text-align: center;
      font-size: 8pt;
      color: #666;
    }
    
    @media print {
      body {
        padding: 0;
      }
      
      .no-print {
        display: none;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${escapeHtml(t('detail.balanceStatement'))}</h1>
  </div>
  
  <div class="summary">
    <div class="summary-row">
      <span><strong>${escapeHtml(t('columns.name'))}:</strong></span>
      <span>${escapeHtml(customer.name)}</span>
    </div>
    <div class="summary-row">
      <span><strong>${escapeHtml(t('columns.code'))}:</strong></span>
      <span>${escapeHtml(customer.sku)}</span>
    </div>
    <div class="summary-row">
      <span><strong>${escapeHtml(t('detail.date'))}:</strong></span>
      <span>${currentDate}</span>
    </div>
    <div class="summary-row">
      <span><strong>${escapeHtml(t('columns.debtIqd'))}:</strong></span>
      <span>${customer.debtIqd.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ع.د</span>
    </div>
    <div class="summary-row">
      <span><strong>${escapeHtml(t('columns.debtUsd'))}:</strong></span>
      <span>$${customer.debtUsd.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
    </div>
    <div class="summary-row">
      <span><strong>${escapeHtml(t('detail.balanceTable.balanceAfter'))}:</strong></span>
      <span>${customer.currentBalance.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ع.د</span>
    </div>
    <div class="summary-row">
      <span><strong>${escapeHtml(t('detail.lastPaymentDate'))}:</strong></span>
      <span>${lastPaymentDate}</span>
    </div>
  </div>
  
  <div class="footer">
    <p>${escapeHtml(t('detail.balanceStatement'))} - ${escapeHtml(customer.name)}</p>
    <p>${currentDate}</p>
  </div>
  
  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 250);
    };
  </script>
</body>
</html>
      `
      
      printWindow.document.write(printContent)
      printWindow.document.close()
      printWindow.focus()
    } catch (error) {
      console.error('Error generating balance statement:', error)
      alert('Failed to generate balance statement. Please try again.')
    }
  }

  const handlePrintPayments = (paymentsData: PaymentData[], customerData: Customer) => {
    if (paymentsData.length === 0) {
      alert(t('detail.paymentTable.noPayments'))
      return
    }

    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const currentDate = format(new Date(), 'PPpp')
    const isRTL = direction === 'rtl'
    const dir = isRTL ? 'rtl' : 'ltr'
    
    // Escape HTML
    const escapeHtml = (text: string) => {
      const div = document.createElement('div')
      div.textContent = text
      return div.innerHTML
    }

    const printContent = `
<!DOCTYPE html>
<html lang="${locale}" dir="${dir}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(t('detail.payments'))} - ${escapeHtml(customerData.name)}</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 1cm;
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    @font-face {
      font-family: 'Kurdish';
      src: url('/assets/fonts/ku.ttf') format('truetype');
      font-display: swap;
    }
    
    body {
      font-family: 'Kurdish', 'Arial Unicode MS', Arial, sans-serif;
      direction: ${dir};
      padding: 20px;
      font-size: 10pt;
      color: #000;
    }
    
    .header {
      text-align: center;
      margin-bottom: 20px;
      border-bottom: 2px solid #000;
      padding-bottom: 15px;
    }
    
    .header h1 {
      font-size: 18pt;
      font-weight: bold;
      margin-bottom: 5px;
      color: #000;
    }
    
    .header-info {
      font-size: 9pt;
      color: #666;
      margin-top: 10px;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 15px;
      table-layout: auto;
      word-wrap: break-word;
    }
    
    thead {
      display: table-header-group;
      background-color: #424242;
      color: #FFFFFF;
    }
    
    th {
      padding: 8px;
      text-align: ${isRTL ? 'right' : 'left'};
      border: 1px solid #C8C8C8;
      font-weight: bold;
      font-size: 9pt;
      vertical-align: middle;
    }
    
    tbody {
      display: table-row-group;
    }
    
    tr {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    
    td {
      padding: 6px;
      border: 1px solid #C8C8C8;
      vertical-align: middle;
      font-size: 9pt;
    }
    
    .text-right {
      text-align: right;
    }
    
    .text-center {
      text-align: center;
    }
    
    .footer {
      margin-top: 20px;
      padding-top: 15px;
      border-top: 1px solid #000;
      text-align: center;
      font-size: 8pt;
      color: #666;
    }
    
    @media print {
      body {
        padding: 0;
      }
      
      .no-print {
        display: none;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${escapeHtml(t('detail.payments'))}</h1>
    <div class="header-info">
      <div><strong>${escapeHtml(t('columns.name'))}:</strong> ${escapeHtml(customerData.name)}</div>
      <div><strong>${escapeHtml(t('columns.code'))}:</strong> ${escapeHtml(customerData.sku)}</div>
      <div><strong>${escapeHtml(t('detail.date'))}:</strong> ${currentDate}</div>
    </div>
  </div>
  
  <table>
    <thead>
      <tr>
        <th>${escapeHtml(t('detail.paymentTable.date'))}</th>
        <th class="text-right">${escapeHtml(t('detail.paymentTable.amountIqd'))}</th>
        <th class="text-right">${escapeHtml(t('detail.paymentTable.amountUsd'))}</th>
        <th>${escapeHtml(t('detail.paymentTable.method'))}</th>
        <th>${escapeHtml(t('detail.paymentTable.description'))}</th>
        <th>${escapeHtml(t('detail.paymentTable.user'))}</th>
      </tr>
    </thead>
    <tbody>
      ${paymentsData.map(payment => `
        <tr>
          <td>${format(new Date(payment.date), 'PPp')}</td>
          <td class="text-right">${payment.amountIqd > 0 ? Math.round(payment.amountIqd).toLocaleString('en-US') + ' ع.د' : '-'}</td>
          <td class="text-right">${payment.amountUsd > 0 ? '$' + Math.round(payment.amountUsd).toLocaleString('en-US') : '-'}</td>
          <td>${escapeHtml(
            payment.paymentMethod === 'CASH' ? 'کاش' :
            payment.paymentMethod === 'BANK_TRANSFER' ? t('detail.paymentTable.bankTransfer') :
            payment.paymentMethod === 'CHECK' ? t('detail.paymentTable.check') :
            payment.paymentMethod === 'OTHER' ? t('detail.paymentTable.other') :
            payment.paymentMethod || t('detail.paymentTable.nA')
          )}</td>
          <td>${escapeHtml(payment.invoiceNumber || payment.description || '-')}</td>
          <td>${escapeHtml(payment.createdBy?.name || payment.createdBy?.email || '-')}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  
  <div class="summary" style="margin-top: 20px; padding: 15px; background-color: #f5f5f5; border: 1px solid #ddd; border-radius: 4px;">
    <div class="summary-row" style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 9pt;">
      <span><strong>${escapeHtml(t('columns.debtIqd'))}:</strong></span>
      <span>${customerData.debtIqd.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ع.د</span>
    </div>
    <div class="summary-row" style="display: flex; justify-content: space-between; margin-bottom: 0; font-size: 9pt;">
      <span><strong>${escapeHtml(t('columns.debtUsd'))}:</strong></span>
      <span>$${customerData.debtUsd.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
    </div>
  </div>
  
  <div class="footer">
    <p>${escapeHtml(t('detail.payments'))} - ${escapeHtml(customerData.name)}</p>
    <p>${currentDate}</p>
  </div>
  
  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 250);
    };
  </script>
</body>
</html>
    `
    
    printWindow.document.write(printContent)
    printWindow.document.close()
    printWindow.focus()
  }

  const hasDebt = customer.debtIqd > 0 || customer.debtUsd > 0
  // Only show as overdue if daysOverdue exceeds the notification threshold (or >= 1 if threshold is null)
  const threshold = customer.notificationDays !== null ? customer.notificationDays : 1
  const isOverdue = customer.daysOverdue >= threshold && hasDebt

  return (
    <div className={cn("flex flex-col gap-6 px-4 md:px-6 lg:px-8 pb-8", fontClass)} style={{ direction } as React.CSSProperties}>
      {/* Header with Back Button and Actions */}
      <div className="flex items-center justify-between pt-4">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.push(`/${locale}/customers`)}
            className={fontClass}
          >
            <IconArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className={cn("text-3xl font-bold", fontClass)}>
            {customer.name}
          </h1>
          {isOverdue && (
            <Badge variant="destructive" className={cn("flex items-center gap-1", fontClass)}>
              <IconAlertCircle className="h-4 w-4" />
              {t('detail.daysOverdue', { days: customer.daysOverdue })}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setIsEditDialogOpen(true)}
            className={fontClass}
          >
            <IconEdit className="mr-2 h-4 w-4" />
            {t('detail.edit')}
          </Button>
          <Button
            variant="destructive"
            onClick={() => setIsDeleteDialogOpen(true)}
            className={fontClass}
          >
            <IconTrash className="mr-2 h-4 w-4" />
            {t('detail.delete')}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className={cn("inline-flex w-auto h-auto", fontClass)}>
          <TabsTrigger value="overview" className={cn("px-4 py-2", fontClass)}>{t('detail.tabs.overview')}</TabsTrigger>
          <TabsTrigger value="invoices" className={cn("px-4 py-2", fontClass)}>{t('detail.tabs.invoices')}</TabsTrigger>
          <TabsTrigger value="attachments" className={cn("px-4 py-2", fontClass)}>{t('detail.tabs.attachments')}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Image */}
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle className={fontClass}>{t('detail.customerImage')}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center gap-4">
                  <Avatar className="h-48 w-48">
                    <AvatarImage src={customer.image || undefined} alt={customer.name} />
                    <AvatarFallback className="text-4xl">{initials}</AvatarFallback>
                  </Avatar>
                </CardContent>
              </Card>

              {/* Payment Actions */}
              <Card className="mt-6">
                <CardContent className="pt-6 space-y-4">
                  <Button
                    onClick={() => setIsPaymentDialogOpen(true)}
                    className={cn("w-full", fontClass)}
                    size="lg"
                  >
                    <IconCurrencyDollar className="mr-2 h-4 w-4" />
                    {t('detail.makePayment')}
                  </Button>
                  
                  <Button
                    onClick={() => handlePrintBalance()}
                    className={cn("w-full", fontClass)}
                    size="lg"
                    variant="outline"
                  >
                    <IconPrinter className="mr-2 h-4 w-4" />
                    {t('detail.printBalance') || 'چاپکردنی باڵانس'}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Details */}
            <div className="lg:col-span-2 space-y-6">
              {/* Basic Information */}
              <Card>
                <CardHeader>
                  <CardTitle className={fontClass}>{t('detail.basicInformation')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={cn("text-sm font-medium text-muted-foreground", fontClass)}>{t('columns.code')}</label>
                      <p className={cn("mt-1 text-sm font-mono", fontClass)}>{customer.sku}</p>
                    </div>
                    {customer.address && (
                      <div>
                        <label className={cn("text-sm font-medium text-muted-foreground", fontClass)}>{t('columns.address')}</label>
                        <p className={cn("mt-1 text-sm", fontClass)}>
                          {typeof customer.address === 'object' && customer.address !== null 
                            ? customer.address.name 
                            : customer.address}
                        </p>
                      </div>
                    )}
                    {customer.phone && (
                      <div>
                        <label className={cn("text-sm font-medium text-muted-foreground", fontClass)}>Phone</label>
                        <p className={cn("mt-1 text-sm", fontClass)}>{customer.phone}</p>
                      </div>
                    )}
                    {customer.email && (
                      <div>
                        <label className={cn("text-sm font-medium text-muted-foreground", fontClass)}>Email</label>
                        <p className={cn("mt-1 text-sm", fontClass)}>{customer.email}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Debt Information */}
              <Card>
                <CardHeader>
                  <CardTitle className={fontClass}>{t('detail.debtInformation')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={cn("text-sm font-medium text-muted-foreground", fontClass)}>{t('columns.debtIqd')}</label>
                      <p className={cn("mt-1 text-lg font-semibold", isOverdue && "text-destructive", fontClass)}>
                        {customer.debtIqd.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ع.د
                      </p>
                    </div>
                    <div>
                      <label className={cn("text-sm font-medium text-muted-foreground", fontClass)}>{t('columns.debtUsd')}</label>
                      <p className={cn("mt-1 text-lg font-semibold", isOverdue && "text-destructive", fontClass)}>
                        ${customer.debtUsd.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                  {isOverdue && (
                    <div className="mt-4 p-3 bg-destructive/10 rounded-md">
                      <p className={cn("text-sm text-destructive", fontClass)}>
                        {t('detail.overdueWarning', { days: customer.daysOverdue })}
                      </p>
                    </div>
                  )}
                  {customer.lastPaymentDate && (
                    <div className="mt-4">
                      <label className={cn("text-sm font-medium text-muted-foreground", fontClass)}>{t('detail.lastPaymentDate')}</label>
                      <p className={cn("mt-1 text-sm", fontClass)}>
                        {format(new Date(customer.lastPaymentDate), 'PPpp')}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Notes */}
              {customer.notes && (
                <Card>
                  <CardHeader>
                    <CardTitle className={fontClass}>{t('detail.notes')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className={cn("text-sm whitespace-pre-wrap", fontClass)}>{customer.notes}</p>
                  </CardContent>
                </Card>
              )}

              {/* Metadata */}
              <Card>
                <CardHeader>
                  <CardTitle className={fontClass}>{t('detail.metadata')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <IconCalendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <label className={cn("text-sm font-medium text-muted-foreground", fontClass)}>{t('detail.dateOfEntry')}</label>
                        <p className={cn("text-sm", fontClass)}>
                          {format(new Date(customer.createdAt), 'PPpp')}
                        </p>
                      </div>
                    </div>
                    {customer.createdBy && (
                      <div className="flex items-center gap-2">
                        <IconUser className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <label className={cn("text-sm font-medium text-muted-foreground", fontClass)}>{t('detail.createdBy')}</label>
                          <p className={cn("text-sm", fontClass)}>
                            {customer.createdBy.name || customer.createdBy.email}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="invoices" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className={fontClass}>{t('detail.invoices')}</CardTitle>
                <Button
                  variant="outline"
                  onClick={() => handlePrintInvoices()}
                  className={fontClass}
                  disabled={invoices.length === 0}
                >
                  <IconPrinter className="mr-2 h-4 w-4" />
                  {t('detail.print')}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search Bar */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder={t('detail.searchInvoices')}
                    value={invoiceSearch}
                    onChange={(e) => {
                      setInvoiceSearch(e.target.value)
                      setInvoicePage(1) // Reset to first page on search
                    }}
                    className={cn("pl-9", fontClass)}
                  />
                </div>
              </div>

              {/* Invoices Table */}
              {loadingInvoices ? (
                <div className="flex items-center justify-center py-8">
                  <Spinner />
                </div>
              ) : invoices.length === 0 ? (
                <div className={cn("text-center py-8 text-muted-foreground", fontClass)}>
                  {t('detail.noInvoicesFound')}
                </div>
              ) : (
                <>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className={fontClass}>{t('detail.balanceTable.type')}</TableHead>
                          <TableHead className={fontClass}>{t('detail.invoiceNumber')}</TableHead>
                          <TableHead className={fontClass}>{t('detail.date')}</TableHead>
                          <TableHead className={cn("text-right", fontClass)}>{t('detail.total')}</TableHead>
                          <TableHead className={cn("text-right", fontClass)}>{t('detail.paid')}</TableHead>
                          <TableHead className={cn("text-right", fontClass)}>{t('detail.due')}</TableHead>
                          <TableHead className={fontClass}>{t('detail.status')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invoices.map((invoice) => {
                          // Determine if it's a motorcycle invoice (USD) or product invoice (IQD)
                          const isMotorcycle = isMotorcycleInvoice(invoice)
                          const currencySymbol = isMotorcycle ? '$' : 'ع.د '
                          
                          // Determine if it's a payment invoice using the same helper
                          const isPaymentInvoice = (() => {
                            if (invoice.notes) {
                              const notes = invoice.notes.toUpperCase()
                              if (notes.includes('PAYMENT') || notes.includes('PAYMENT INVOICE')) {
                                return true
                              }
                            }
                            if (invoice.items && invoice.items.length > 0) {
                              return invoice.items.some((item: any) => {
                                if (item.notes) {
                                  const itemNotes = item.notes.toUpperCase().trim()
                                  if (itemNotes.startsWith('PAYMENT:')) {
                                    return true
                                  }
                                }
                                return false
                              })
                            }
                            return false
                          })()
                          const invoiceType = isPaymentInvoice 
                            ? t('detail.balanceTable.typePayment') 
                            : t('detail.balanceTable.typeInvoice')
                          
                          // Determine status - if nothing is paid, show "Unpaid"
                          let displayStatus = invoice.status
                          if (invoice.amountPaid === 0 && invoice.amountDue > 0) {
                            displayStatus = 'UNPAID'
                          }
                          
                          return (
                          <TableRow 
                            key={invoice.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => router.push(`/${locale}/invoices/${invoice.id}`)}
                          >
                            <TableCell className={fontClass}>
                              {invoiceType}
                            </TableCell>
                            <TableCell className={cn("font-mono", fontClass)}>
                              {invoice.invoiceNumber}
                            </TableCell>
                            <TableCell className={fontClass}>
                              {format(new Date(invoice.invoiceDate), 'PP')}
                            </TableCell>
                            <TableCell className={cn("text-right font-medium", fontClass)}>
                              {currencySymbol}{Math.round(invoice.total).toLocaleString('en-US')}
                            </TableCell>
                            <TableCell className={cn("text-right", fontClass)}>
                              {currencySymbol}{Math.round(invoice.amountPaid).toLocaleString('en-US')}
                            </TableCell>
                            <TableCell className={cn("text-right font-medium", fontClass)}>
                              {currencySymbol}{Math.round(invoice.amountDue).toLocaleString('en-US')}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  displayStatus === 'PAID'
                                    ? 'default'
                                    : displayStatus === 'PARTIALLY_PAID'
                                    ? 'secondary'
                                    : displayStatus === 'OVERDUE'
                                    ? 'destructive'
                                    : displayStatus === 'UNPAID'
                                    ? 'destructive'
                                    : 'outline'
                                }
                                className={cn(
                                  fontClass,
                                  displayStatus === 'UNPAID'
                                    ? 'bg-red-600 text-white dark:bg-red-700 dark:text-white border-red-600'
                                    : isPaymentInvoice 
                                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100 border-blue-200' 
                                    : displayStatus === 'PAID'
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 border-green-200'
                                    : displayStatus === 'PARTIALLY_PAID'
                                    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100 border-yellow-200'
                                    : displayStatus === 'OVERDUE'
                                    ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100 border-red-200'
                                    : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100 border-gray-200'
                                )}
                              >
                                {displayStatus === 'PAID' 
                                  ? t('detail.statusPaid')
                                  : displayStatus === 'PARTIALLY_PAID'
                                  ? t('detail.statusPartiallyPaid')
                                  : displayStatus === 'OVERDUE'
                                  ? t('detail.statusOverdue')
                                  : displayStatus === 'UNPAID'
                                  ? t('detail.statusUnpaid')
                                  : displayStatus === 'FINALIZED'
                                  ? t('detail.statusFinalized') || 'FINALIZED'
                                  : displayStatus.replace('_', ' ')}
                              </Badge>
                            </TableCell>
                          </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination */}
                  <div className="flex items-center justify-between">
                    <div className={cn("text-muted-foreground text-sm", fontClass)}>
                      {t('detail.showing')} {((invoicePage - 1) * invoicePageSize) + 1} {t('detail.to')} {Math.min(invoicePage * invoicePageSize, invoicePaginationMeta.total)} {t('detail.of')} {invoicePaginationMeta.total} {t('detail.invoiceCount')}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={cn("flex items-center gap-2", fontClass)}>
                        <Label htmlFor="invoice-rows-per-page" className={cn("text-sm font-medium", fontClass)}>
                          {t('pagination.rowsPerPage')}
                        </Label>
                        <div suppressHydrationWarning>
                          <Select
                            value={`${invoicePageSize}`}
                            onValueChange={(value) => {
                              setInvoicePageSize(Number(value))
                              setInvoicePage(1)
                            }}
                          >
                            <SelectTrigger size="sm" className="w-20" id="invoice-rows-per-page">
                              <SelectValue placeholder={invoicePageSize} />
                            </SelectTrigger>
                            <SelectContent side="top">
                              {[10, 20, 50, 100].map((size) => (
                                <SelectItem key={size} value={`${size}`}>
                                  {size}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className={cn("flex w-fit items-center justify-center text-sm font-medium", fontClass)}>
                        {t('pagination.page')} {invoicePage} {t('pagination.of')} {invoicePaginationMeta.totalPages || 1}
                      </div>
                      <div className="ml-auto flex items-center gap-2 lg:ml-0">
                        <Button
                          variant="outline"
                          className="hidden h-8 w-8 p-0 lg:flex"
                          onClick={() => setInvoicePage(1)}
                          disabled={invoicePage === 1}
                        >
                          <span className="sr-only">Go to first page</span>
                          <IconChevronsLeft />
                        </Button>
                        <Button
                          variant="outline"
                          className="size-8"
                          size="icon"
                          onClick={() => setInvoicePage(prev => Math.max(1, prev - 1))}
                          disabled={invoicePage === 1}
                        >
                          <span className="sr-only">Go to previous page</span>
                          <IconChevronLeft />
                        </Button>
                        <Button
                          variant="outline"
                          className="size-8"
                          size="icon"
                          onClick={() => setInvoicePage(prev => Math.min(invoicePaginationMeta.totalPages || 1, prev + 1))}
                          disabled={invoicePage >= (invoicePaginationMeta.totalPages || 1)}
                        >
                          <span className="sr-only">Go to next page</span>
                          <IconChevronRight />
                        </Button>
                        <Button
                          variant="outline"
                          className="hidden size-8 lg:flex"
                          size="icon"
                          onClick={() => setInvoicePage(invoicePaginationMeta.totalPages || 1)}
                          disabled={invoicePage >= (invoicePaginationMeta.totalPages || 1)}
                        >
                          <span className="sr-only">Go to last page</span>
                          <IconChevronsRight />
                        </Button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attachments" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className={fontClass}>{t('detail.attachments')}</CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const parseAttachments = () => {
                  if (!customer.attachment) return []
                  
                  try {
                    const parsed = JSON.parse(customer.attachment)
                    if (Array.isArray(parsed)) {
                      return parsed.map((item: string | { url: string; name: string; type: string }) => {
                        if (typeof item === 'string') {
                          const fileName = item.split('/').pop() || 'attachment'
                          const extension = fileName.split('.').pop()?.toLowerCase() || ''
                          return {
                            url: item,
                            name: fileName,
                            type: extension
                          }
                        }
                        return item
                      })
                    }
                  } catch {
                    // If not JSON, treat as single attachment
                    const fileName = customer.attachment.split('/').pop() || 'attachment'
                    const extension = fileName.split('.').pop()?.toLowerCase() || ''
                    return [{
                      url: customer.attachment,
                      name: fileName,
                      type: extension
                    }]
                  }
                  
                  return []
                }

                const attachments = parseAttachments()

                const getFileIcon = (type: string) => {
                  const imageTypes = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']
                  if (imageTypes.includes(type)) {
                    return '🖼️'
                  }
                  if (type === 'pdf') return '📄'
                  if (['doc', 'docx'].includes(type)) return '📝'
                  if (['xls', 'xlsx'].includes(type)) return '📊'
                  return '📎'
                }

                return (
                  <>
                    {attachments.length === 0 ? (
                      <div className={cn("text-center py-12 text-muted-foreground", fontClass)}>
                        <IconPaperclip className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>{t('detail.noAttachments')}</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                        {attachments.map((attachment, index) => (
                          <div
                            key={index}
                            className="group relative border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex items-start gap-3">
                              <div className="text-3xl flex-shrink-0">
                                {getFileIcon(attachment.type)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className={cn("text-sm font-medium truncate", fontClass)}>
                                    {attachment.name}
                                  </p>
                                  <Badge variant="outline" className={cn("text-xs flex-shrink-0", fontClass)}>
                                    {attachment.type.toUpperCase()}
                                  </Badge>
                                </div>
                                <a
                                  href={attachment.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={cn("text-xs text-muted-foreground hover:text-primary flex items-center gap-1", fontClass)}
                                >
                                  {t('detail.view')} <IconExternalLink className="h-3 w-3" />
                                </a>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => attachmentInputRef.current?.click()}
                      className={cn("w-full justify-start", fontClass)}
                      disabled={isUploadingAttachments}
                    >
                      <IconPlus className="mr-2 h-4 w-4" />
                      {isUploadingAttachments ? t('dialog.updating') || 'Uploading...' : t('dialog.addAttachment')}
                    </Button>
                    <input
                      ref={attachmentInputRef}
                      type="file"
                      multiple
                      onChange={handleAttachmentChange}
                      className="hidden"
                      accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                    />
                  </>
                )
              })()}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <CustomerDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSuccess={handleEditSuccess}
        addresses={addresses}
        customer={customer}
      />

      {/* Delete Dialog */}
      <DeleteCustomerDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onSuccess={handleDeleteSuccess}
        customerName={customer.name}
        customerId={customer.id}
      />

      {/* Payment Dialog */}
      <AlertDialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <AlertDialogContent 
          className={cn("!max-w-[600px] w-[100vw] max-h-[90vh] overflow-y-auto", fontClass)} 
          style={{ direction } as React.CSSProperties}
        >
          <AlertDialogHeader>
            <div className="flex items-start justify-between">
              <div>
                <AlertDialogTitle 
                  className={cn(direction === 'rtl' && 'text-right', fontClass, "text-xl flex items-center gap-2")}
                  style={{ direction } as React.CSSProperties}
                >
                  <IconCurrencyDollar className="h-5 w-5" />
                  {t('detail.paymentDialog.title')}
                </AlertDialogTitle>
                <AlertDialogDescription 
                  className={cn(direction === 'rtl' && 'text-right', fontClass, "mt-1")}
                  style={{ direction } as React.CSSProperties}
                >
                  {t('detail.paymentDialog.description', { name: customer.name })}
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="paymentIqd" className={fontClass}>{t('detail.paymentDialog.amountIqd')}</Label>
                <Input
                  id="paymentIqd"
                  type="number"
                  step="0.01"
                  min="0"
                  value={paymentAmountIqd}
                  onChange={(e) => setPaymentAmountIqd(e.target.value)}
                  placeholder="0.00"
                  className={fontClass}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="paymentUsd" className={fontClass}>{t('detail.paymentDialog.amountUsd')}</Label>
                <Input
                  id="paymentUsd"
                  type="number"
                  step="0.01"
                  min="0"
                  value={paymentAmountUsd}
                  onChange={(e) => setPaymentAmountUsd(e.target.value)}
                  placeholder="0.00"
                  className={fontClass}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentMethod" className={fontClass}>{t('detail.paymentDialog.paymentMethod')}</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className={fontClass}>
                  <SelectValue placeholder={t('detail.paymentDialog.selectMethod')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">{t('detail.paymentDialog.cash')}</SelectItem>
                  <SelectItem value="BANK_TRANSFER">{t('detail.paymentDialog.bankTransfer')}</SelectItem>
                  <SelectItem value="CHECK">{t('detail.paymentDialog.check')}</SelectItem>
                  <SelectItem value="OTHER">{t('detail.paymentDialog.other')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentDescription" className={fontClass}>{t('detail.paymentDialog.descriptionLabel')}</Label>
              <Textarea
                id="paymentDescription"
                value={paymentDescription}
                onChange={(e) => setPaymentDescription(e.target.value)}
                placeholder={t('detail.paymentDialog.descriptionPlaceholder')}
                className={fontClass}
                rows={3}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setIsPaymentDialogOpen(false)}
              disabled={isProcessingPayment}
              className={fontClass}
            >
              {t('detail.paymentDialog.cancel')}
            </AlertDialogCancel>
            <Button
              onClick={handlePayment}
              disabled={isProcessingPayment}
              className={fontClass}
            >
              {isProcessingPayment ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  {t('detail.paymentDialog.processing')}
                </>
              ) : (
                t('detail.paymentDialog.processPayment')
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// Payment table component
function PaymentTable({ 
  data, 
  loading,
  fontClass,
  columnSizing,
  setColumnSizing,
  t
}: { 
  data: PaymentData[]
  loading: boolean
  fontClass: string
  columnSizing: ColumnSizingState
  setColumnSizing: (sizing: ColumnSizingState) => void
  t: any
}) {
  const columns: ColumnDef<PaymentData>[] = [
    {
      accessorKey: 'date',
      header: t('detail.paymentTable.date'),
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
      accessorKey: 'amountIqd',
      header: () => <div className={cn("text-right", fontClass)}>{t('detail.paymentTable.amountIqd')}</div>,
      size: 130,
      minSize: 110,
      maxSize: 200,
      cell: ({ row }) => {
        const amount = row.original.amountIqd
        if (amount === 0) return <span className={cn("text-muted-foreground", fontClass)}>-</span>
        return (
          <div className={cn("text-right font-medium", fontClass)}>
            {Math.round(amount).toLocaleString('en-US')} ع.د
          </div>
        )
      },
    },
    {
      accessorKey: 'amountUsd',
      header: () => <div className={cn("text-right", fontClass)}>{t('detail.paymentTable.amountUsd')}</div>,
      size: 130,
      minSize: 110,
      maxSize: 200,
      cell: ({ row }) => {
        const amount = row.original.amountUsd
        if (amount === 0) return <span className={cn("text-muted-foreground", fontClass)}>-</span>
        return (
          <div className={cn("text-right font-medium", fontClass)}>
            ${Math.round(amount).toLocaleString('en-US')}
          </div>
        )
      },
    },
    {
      accessorKey: 'paymentMethod',
      header: t('detail.paymentTable.method'),
      size: 120,
      minSize: 100,
      maxSize: 150,
      cell: ({ row }) => {
        const method = row.original.paymentMethod
        const methodText = method === 'CASH' ? 'کاش' :
          method === 'BANK_TRANSFER' ? t('detail.paymentTable.bankTransfer') :
          method === 'CHECK' ? t('detail.paymentTable.check') :
          method === 'OTHER' ? t('detail.paymentTable.other') :
          method || t('detail.paymentTable.nA')
        return (
          <Badge variant="outline" className={fontClass}>
            {methodText}
          </Badge>
        )
      },
    },
    {
      accessorKey: 'description',
      header: t('detail.paymentTable.description'),
      size: 200,
      minSize: 150,
      maxSize: 400,
      cell: ({ row }) => (
        <span className={cn("text-sm text-muted-foreground", fontClass)}>
          {row.original.description || '-'}
        </span>
      ),
    },
  ]

  const table = useReactTable({
    data,
    columns,
    state: {
      columnSizing,
    },
    onColumnSizingChange: (updater) => {
      setColumnSizing(typeof updater === 'function' ? updater(columnSizing) : updater)
    },
    getCoreRowModel: getCoreRowModel(),
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
  })

  if (loading) {
    return <div className={cn("text-center py-8 text-muted-foreground", fontClass)}>{t('detail.paymentTable.loading')}</div>
  }

  if (data.length === 0) {
    return <div className={cn("text-center py-8 text-muted-foreground", fontClass)}>{t('detail.paymentTable.noPayments')}</div>
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
                  style={{
                    width: header.getSize() !== 150 ? `${header.getSize()}px` : undefined,
                    position: 'relative',
                    minWidth: header.column.columnDef.minSize ? `${header.column.columnDef.minSize}px` : '50px',
                    maxWidth: header.column.columnDef.maxSize ? `${header.column.columnDef.maxSize}px` : undefined,
                  }}
                  className="select-none"
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                  {header.column.getCanResize() && (
                    <div
                      onMouseDown={header.getResizeHandler()}
                      onTouchStart={header.getResizeHandler()}
                      className={cn(
                        "absolute right-0 top-0 h-full w-1 cursor-col-resize touch-none select-none bg-transparent hover:bg-primary/50 transition-colors z-10",
                        header.column.getIsResizing() && "bg-primary"
                      )}
                      style={{
                        transform: header.column.getIsResizing()
                          ? `translateX(${table.getState().columnSizingInfo.deltaOffset ?? 0}px)`
                          : undefined,
                      }}
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
                  style={{
                    width: cell.column.getSize() !== 150 ? `${cell.column.getSize()}px` : undefined,
                  }}
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

// Balance statement table component
function BalanceTable({ 
  data, 
  loading,
  fontClass,
  columnSizing,
  setColumnSizing,
  customer,
  t
}: { 
  data: BalanceData[]
  loading: boolean
  fontClass: string
  columnSizing: ColumnSizingState
  setColumnSizing: (sizing: ColumnSizingState) => void
  customer: Customer
  t: any
}) {
  const columns: ColumnDef<BalanceData>[] = [
    {
      accessorKey: 'date',
      header: t('detail.balanceTable.date'),
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
      accessorKey: 'type',
      header: t('detail.balanceTable.type'),
      size: 120,
      minSize: 100,
      maxSize: 150,
      cell: ({ row }) => {
        const type = row.original.type
        const colors = {
          payment: 'bg-green-100 text-green-800',
          invoice: 'bg-blue-100 text-blue-800',
          sale: 'bg-purple-100 text-purple-800',
          adjustment: 'bg-orange-100 text-orange-800',
        }
        return (
          <Badge className={cn(colors[type] || 'bg-gray-100 text-gray-800', fontClass)}>
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </Badge>
        )
      },
    },
    {
      accessorKey: 'amount',
      header: () => <div className={cn("text-right", fontClass)}>{t('detail.balanceTable.amount')}</div>,
      size: 130,
      minSize: 110,
      maxSize: 200,
      cell: ({ row }) => {
        const amount = row.original.amount
        const isCredit = amount < 0
        return (
          <div className={cn("text-right font-medium", isCredit ? "text-green-600" : "text-red-600", fontClass)}>
            {isCredit ? '+' : ''}{Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ع.د
          </div>
        )
      },
    },
    {
      accessorKey: 'balance',
      header: () => <div className={cn("text-right", fontClass)}>{t('detail.balanceTable.balanceAfter')}</div>,
      size: 130,
      minSize: 110,
      maxSize: 200,
      cell: ({ row }) => (
        <div className={cn("text-right font-semibold", fontClass)}>
          {row.original.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ع.د
        </div>
      ),
    },
    {
      accessorKey: 'invoice',
      header: t('detail.balanceTable.invoiceNumber'),
      size: 150,
      minSize: 120,
      maxSize: 200,
      cell: ({ row }) => {
        const invoice = row.original.invoice
        if (invoice) {
          return (
            <span className={cn("text-sm font-mono text-blue-600", fontClass)}>
              {invoice.invoiceNumber}
            </span>
          )
        }
        return <span className={cn("text-sm text-muted-foreground", fontClass)}>-</span>
      },
    },
    {
      accessorKey: 'description',
      header: t('detail.balanceTable.description'),
      size: 250,
      minSize: 200,
      maxSize: 400,
      cell: ({ row }) => {
        const invoice = row.original.invoice
        if (invoice) {
          return (
            <div className={cn("text-sm", fontClass)}>
              <div className="font-medium">Invoice {invoice.invoiceNumber}</div>
              <div className="text-muted-foreground text-xs mt-1">
                Total: ${invoice.total.toLocaleString()} | 
                Paid: ${invoice.amountPaid.toLocaleString()} | 
                Due: ${invoice.amountDue.toLocaleString()}
              </div>
              {row.original.amount > 0 && (
                <div className="text-red-600 text-xs mt-1">
                  ↑ Increased debt by ${Math.abs(row.original.amount).toLocaleString()}
                </div>
              )}
              {row.original.amount < 0 && (
                <div className="text-green-600 text-xs mt-1">
                  ↓ Payment of ${Math.abs(row.original.amount).toLocaleString()}
                </div>
              )}
            </div>
          )
        }
        return (
          <span className={cn("text-sm text-muted-foreground", fontClass)}>
            {row.original.description || '-'}
          </span>
        )
      },
    },
  ]

  const table = useReactTable({
    data,
    columns,
    state: {
      columnSizing,
    },
    onColumnSizingChange: (updater) => {
      setColumnSizing(typeof updater === 'function' ? updater(columnSizing) : updater)
    },
    getCoreRowModel: getCoreRowModel(),
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
  })

  if (loading) {
    return <div className={cn("text-center py-8 text-muted-foreground", fontClass)}>{t('detail.balanceTable.loading')}</div>
  }

  if (data.length === 0) {
    return <div className={cn("text-center py-8 text-muted-foreground", fontClass)}>{t('detail.balanceTable.noHistory')}</div>
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
                  style={{
                    width: header.getSize() !== 150 ? `${header.getSize()}px` : undefined,
                    position: 'relative',
                    minWidth: header.column.columnDef.minSize ? `${header.column.columnDef.minSize}px` : '50px',
                    maxWidth: header.column.columnDef.maxSize ? `${header.column.columnDef.maxSize}px` : undefined,
                  }}
                  className="select-none"
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                  {header.column.getCanResize() && (
                    <div
                      onMouseDown={header.getResizeHandler()}
                      onTouchStart={header.getResizeHandler()}
                      className={cn(
                        "absolute right-0 top-0 h-full w-1 cursor-col-resize touch-none select-none bg-transparent hover:bg-primary/50 transition-colors z-10",
                        header.column.getIsResizing() && "bg-primary"
                      )}
                      style={{
                        transform: header.column.getIsResizing()
                          ? `translateX(${table.getState().columnSizingInfo.deltaOffset ?? 0}px)`
                          : undefined,
                      }}
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
                  style={{
                    width: cell.column.getSize() !== 150 ? `${cell.column.getSize()}px` : undefined,
                  }}
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

