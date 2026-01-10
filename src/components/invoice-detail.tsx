"use client"

import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { getTextDirection } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { IconArrowLeft, IconEdit, IconFileText, IconPrinter, IconUser, IconCalendar } from '@tabler/icons-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

type Invoice = {
  id: string
  invoiceNumber: string
  status: string
  subtotal: number
  taxAmount: number
  discount: number
  total: number
  amountPaid: number
  amountDue: number
  invoiceDate: string
  dueDate: string | null
  paidAt: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  customer: {
    id: string
    name: string
    sku: string
    email: string | null
    phone: string | null
    debtIqd: number
    debtUsd: number
    currentBalance: number
  } | null
  createdBy: {
    id: string
    name: string | null
    email: string
  } | null
  sale: {
    id: string
    type: string
    status: string
    paymentMethod: string | null
    items: Array<{
      id: string
      quantity: number
      unitPrice: number
      discount: number
      taxRate: number
      lineTotal: number
      notes: string | null
      product: {
        id: string
        name: string
        sku: string
        stockQuantity: number
      } | null
    }>
  } | null
  items: Array<{
    id: string
    quantity: number
    unitPrice: number
    discount: number
    taxRate: number
    lineTotal: number
    notes: string | null
    order: number
    product: {
      id: string
      name: string
      sku: string
      stockQuantity: number
    } | null
  }>
}

interface InvoiceDetailProps {
  invoice: Invoice
  locale: string
}

export function InvoiceDetail({ invoice, locale }: InvoiceDetailProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations('navigation.invoiceDetail')
  const fontClass = locale === 'ku' ? 'font-kurdish' : 'font-engar'
  const direction = getTextDirection(locale as 'ku' | 'en' | 'ar')
  const isRTL = direction === 'rtl'
  const [motorcycleData, setMotorcycleData] = useState<Record<string, { brand: string; model: string; sku: string }>>({})
  
  // Auto-print if print parameter is present
  useEffect(() => {
    if (searchParams.get('print') === 'true') {
      setTimeout(() => {
        handlePrint()
      }, 500)
    }
  }, [searchParams])

  const isWholesale = invoice.sale?.type === 'JUMLA'
  const isRetail = invoice.sale?.type === 'MUFRAD'
  
  // Payment detection (same logic as customer-detail.tsx)
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
  
  // Robust motorcycle detection (same logic as invoices table)
  const isMotorcycle = (() => {
    // Method 1: Check invoice notes for invoice type (most reliable)
    // Format: [INVOICE_TYPE:wholesale-motorcycle] or [INVOICE_TYPE:retail-motorcycle]
    if (invoice.notes) {
      const notes = invoice.notes.toUpperCase()
      if (notes.includes('[INVOICE_TYPE:') && notes.includes('MOTORCYCLE')) {
        return true
      }
    }
    
    // Method 2: Check invoice items for motorcycle markers
    if (invoice.items && invoice.items.length > 0) {
      const hasMotorcycle = invoice.items.some((item: any) => {
        // Primary check: If product is null and notes exist, check if it's a motorcycle
        // Motorcycles are stored with product: null and notes starting with "MOTORCYCLE:"
        if (!item.product && item.notes) {
          const notes = item.notes.toUpperCase().trim()
          if (notes.startsWith('MOTORCYCLE:')) {
            return true
          }
        }
        
        // Secondary check: Check product name (for backward compatibility)
    const productName = item.product?.name?.toLowerCase() || ''
        const itemNotes = item.notes?.toLowerCase() || ''
        if (productName.includes('motorcycle') || itemNotes.startsWith('motorcycle:')) {
          return true
        }
        
        return false
      })
      
      if (hasMotorcycle) {
        return true
      }
    }
    
    // Method 3: If no items or notes, default to false (assume product/IQD)
    return false
  })()
  
  const currencySymbol = isMotorcycle ? '$' : 'ع.د '
    const currencyLabel = isMotorcycle ? 'USD' : 'ع.د'

  // Fetch motorcycle details for items that need them
  useEffect(() => {
    const fetchMotorcycleDetails = async () => {
      // Get all motorcycle IDs from invoice items
      const motorcycleIds: string[] = []
      
      // Check invoice.items
      if (invoice.items && invoice.items.length > 0) {
        invoice.items.forEach((item: any) => {
          if (item.notes?.toUpperCase().trim().startsWith('MOTORCYCLE:')) {
            const motorcycleId = item.notes.replace(/^MOTORCYCLE:/i, '').trim()
            if (motorcycleId && !motorcycleData[motorcycleId]) {
              motorcycleIds.push(motorcycleId)
            }
          }
        })
      }
      
      // Check sale.items if invoice.items is empty
      if ((!invoice.items || invoice.items.length === 0) && invoice.sale?.items) {
        invoice.sale.items.forEach((item: any) => {
          if (item.notes?.toUpperCase().trim().startsWith('MOTORCYCLE:')) {
            const motorcycleId = item.notes.replace(/^MOTORCYCLE:/i, '').trim()
            if (motorcycleId && !motorcycleData[motorcycleId]) {
              motorcycleIds.push(motorcycleId)
            }
          }
        })
      }
      
      // Fetch all motorcycle details
      if (motorcycleIds.length > 0) {
        const fetchPromises = motorcycleIds.map(async (id) => {
          try {
            const response = await fetch(`/api/motorcycles/${id}`)
            if (response.ok) {
              const data = await response.json()
              if (data.motorcycle) {
                return { id, ...data.motorcycle }
              }
            }
          } catch (error) {
            console.warn(`Error fetching motorcycle ${id}:`, error)
          }
          return null
        })
        
        const results = await Promise.all(fetchPromises)
        const newMotorcycleData: Record<string, { brand: string; model: string; sku: string }> = {}
        results.forEach((result) => {
          if (result) {
            newMotorcycleData[result.id] = {
              brand: result.brand || '',
              model: result.model || '',
              sku: result.sku || result.id
            }
          }
        })
        
        if (Object.keys(newMotorcycleData).length > 0) {
          setMotorcycleData(prev => ({ ...prev, ...newMotorcycleData }))
        }
      }
    }
    
    fetchMotorcycleDetails()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice.id]) // Only fetch once when invoice changes

  const statusColors: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100',
    FINALIZED: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
    PAID: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
    PARTIALLY_PAID: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100',
    OVERDUE: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
    CANCELLED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
  }

  const getTypeLabel = () => {
    if (isPaymentInvoice) return t('typePayment')
    if (isWholesale && isMotorcycle) return t('typeWholesaleMotorcycle')
    if (isWholesale) return t('typeWholesaleProduct')
    if (isRetail && isMotorcycle) return t('typeRetailMotorcycle')
    if (isRetail) return t('typeRetailProduct')
    return t('typeInvoice')
  }
  
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'PAID': return t('statusPaid')
      case 'PARTIALLY_PAID': return t('statusPartiallyPaid')
      case 'OVERDUE': return t('statusOverdue')
      case 'UNPAID': return t('statusUnpaid')
      case 'FINALIZED': return t('statusFinalized')
      case 'DRAFT': return t('statusDraft')
      case 'CANCELLED': return t('statusCancelled')
      default: return status.replace('_', ' ')
    }
  }
  
  const getPaymentMethodLabel = (method: string | null) => {
    if (!method) return ''
    const methodUpper = method.toUpperCase()
    const methodKey = methodUpper.replace(/[^A-Z_]/g, '')
    
    // Try exact match first
    const exactKey = `paymentMethods.${methodKey}`
    const exactTranslation = t(exactKey as any)
    if (exactTranslation && exactTranslation !== exactKey) {
      return exactTranslation
    }
    
    // Try lowercase key
    const lowerKey = `paymentMethods.${method.toLowerCase()}`
    const lowerTranslation = t(lowerKey as any)
    if (lowerTranslation && lowerTranslation !== lowerKey) {
      return lowerTranslation
    }
    
    // Fallback to original method
    return method
  }

  const handleEdit = () => {
    router.push(`/${locale}/invoices/${invoice.id}/edit`)
  }

  const handlePrint = async () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const currentDate = format(new Date(), 'PPpp')
    const dir = isRTL ? 'rtl' : 'ltr'

    // Escape HTML
    const escapeHtml = (text: string) => {
      const div = document.createElement('div')
      div.textContent = text
      return div.innerHTML
    }

    // Get items to display
    const itemsToDisplay = (invoice.items && invoice.items.length > 0) 
      ? invoice.items 
      : (invoice.sale?.items || [])

    // Fetch images and details for items (products and motorcycles)
    const itemsWithImages = await Promise.all(itemsToDisplay.map(async (item: any) => {
      let imageUrl: string | null = null
      let sku: string | null = null
      let brandOrProductName: string | null = null
      
      // Check if it's a product item
      if (item.product) {
        imageUrl = item.product.image || null
        sku = item.product.sku || null
        brandOrProductName = item.product.name || null
      } 
      // Check if it's a motorcycle item
      else if (item.notes?.toUpperCase().trim().startsWith('MOTORCYCLE:')) {
        const motorcycleId = item.notes.replace(/^MOTORCYCLE:/i, '').trim()
        if (motorcycleId) {
          try {
            const motoResponse = await fetch(`/api/motorcycles/${motorcycleId}`)
            if (motoResponse.ok) {
              const motoData = await motoResponse.json()
              if (motoData.motorcycle) {
                imageUrl = motoData.motorcycle.image || null
                sku = motoData.motorcycle.sku || null
                brandOrProductName = motoData.motorcycle.brand || null
              }
            }
          } catch (error) {
            console.warn('Error fetching motorcycle details for print:', error)
          }
        }
      } else if (item.notes?.toUpperCase().trim().startsWith('PAYMENT:')) {
        // Payment item
        sku = 'PAYMENT'
        brandOrProductName = t('typePayment')
      }
      
      return { ...item, imageUrl, sku, brandOrProductName }
    }))

    const printContent = `
<!DOCTYPE html>
<html lang="${locale}" dir="${dir}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(t('invoiceInformation'))} - ${escapeHtml(invoice.invoiceNumber)}</title>
  <style>
    @page {
      size: A4;
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
      margin-bottom: 10px;
      color: #000;
    }
    
    .header-info {
      font-size: 9pt;
      color: #666;
      margin-top: 5px;
    }
    
    .info-section {
      margin-bottom: 20px;
      padding: 15px;
      background-color: #f5f5f5;
      border: 1px solid #ddd;
      border-radius: 4px;
    }
    
    .info-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 9pt;
    }
    
    .info-row:last-child {
      margin-bottom: 0;
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
    <h1>${escapeHtml(t('invoiceInformation'))}</h1>
    <div class="header-info">
      <div><strong>${escapeHtml(t('invoiceNumber'))}:</strong> ${escapeHtml(invoice.invoiceNumber)}</div>
      <div><strong>${escapeHtml(t('type'))}:</strong> ${escapeHtml(getTypeLabel())}</div>
      <div><strong>${escapeHtml(t('invoiceDate'))}:</strong> ${escapeHtml(format(new Date(invoice.invoiceDate), 'PPpp'))}</div>
    </div>
  </div>
  
  <div class="info-section">
    <div class="info-row">
      <span><strong>${escapeHtml(t('invoiceNumber'))}:</strong></span>
      <span>${escapeHtml(invoice.invoiceNumber)}</span>
    </div>
    <div class="info-row">
      <span><strong>${escapeHtml(t('type'))}:</strong></span>
      <span>${escapeHtml(getTypeLabel())}</span>
    </div>
    <div class="info-row">
      <span><strong>${escapeHtml(t('invoiceDate'))}:</strong></span>
      <span>${escapeHtml(format(new Date(invoice.invoiceDate), 'PPpp'))}</span>
    </div>
    ${invoice.dueDate ? `
    <div class="info-row">
      <span><strong>${escapeHtml(t('dueDate'))}:</strong></span>
      <span>${escapeHtml(format(new Date(invoice.dueDate), 'PPpp'))}</span>
    </div>
    ` : ''}
    ${invoice.paidAt ? `
    <div class="info-row">
      <span><strong>${escapeHtml(t('paidAt'))}:</strong></span>
      <span>${escapeHtml(format(new Date(invoice.paidAt), 'PPpp'))}</span>
    </div>
    ` : ''}
    ${invoice.sale?.paymentMethod ? `
    <div class="info-row">
      <span><strong>${escapeHtml(t('paymentMethod'))}:</strong></span>
      <span>${escapeHtml(getPaymentMethodLabel(invoice.sale.paymentMethod))}</span>
    </div>
    ` : ''}
    <div class="info-row">
      <span><strong>${escapeHtml(t('status'))}:</strong></span>
      <span>${escapeHtml(getStatusLabel(invoice.status))}</span>
    </div>
  </div>

  <h2 style="font-size: 12pt; margin-top: 20px; margin-bottom: 10px;">${escapeHtml(t('financialSummary'))}</h2>
  <div class="info-section">
    <div class="info-row">
      <span><strong>${escapeHtml(t('subtotal'))} (${currencyLabel}):</strong></span>
      <span>${currencySymbol}${invoice.subtotal.toLocaleString('en-US', { minimumFractionDigits: isMotorcycle ? 2 : 0, maximumFractionDigits: 2 })}</span>
    </div>
    ${invoice.discount > 0 ? `
    <div class="info-row">
      <span><strong>${escapeHtml(t('discount'))}:</strong></span>
      <span>-${currencySymbol}${invoice.discount.toLocaleString('en-US', { minimumFractionDigits: isMotorcycle ? 2 : 0, maximumFractionDigits: 2 })}</span>
    </div>
    ` : ''}
    ${invoice.taxAmount > 0 ? `
    <div class="info-row">
      <span><strong>${escapeHtml(t('tax'))}:</strong></span>
      <span>${currencySymbol}${invoice.taxAmount.toLocaleString('en-US', { minimumFractionDigits: isMotorcycle ? 2 : 0, maximumFractionDigits: 2 })}</span>
    </div>
    ` : ''}
    <div class="info-row" style="border-top: 1px solid #ddd; padding-top: 8px; font-weight: bold;">
      <span><strong>${escapeHtml(t('total'))} (${currencyLabel}):</strong></span>
      <span>${currencySymbol}${invoice.total.toLocaleString('en-US', { minimumFractionDigits: isMotorcycle ? 2 : 0, maximumFractionDigits: 2 })}</span>
    </div>
    <div class="info-row">
      <span><strong>${escapeHtml(t('amountPaid'))}:</strong></span>
      <span>${currencySymbol}${invoice.amountPaid.toLocaleString('en-US', { minimumFractionDigits: isMotorcycle ? 2 : 0, maximumFractionDigits: 2 })}</span>
    </div>
    <div class="info-row">
      <span><strong>${escapeHtml(t('amountDue'))}:</strong></span>
      <span>${currencySymbol}${invoice.amountDue.toLocaleString('en-US', { minimumFractionDigits: isMotorcycle ? 2 : 0, maximumFractionDigits: 2 })}</span>
    </div>
  </div>

  <h2 style="font-size: 12pt; margin-top: 20px; margin-bottom: 10px;">${escapeHtml(t('invoiceItems'))}</h2>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>${escapeHtml((() => {
          try {
            const translation = t('image')
            // Check if translation is valid (not the key path)
            if (translation && !translation.includes('navigation.invoiceDetail') && !translation.includes('image')) {
              return translation
            }
          } catch (e) {
            // Ignore error
          }
          // Fallback based on locale
          return locale === 'ku' ? 'وێنە' : locale === 'ar' ? 'صورة' : 'Image'
        })())}</th>
        <th>${escapeHtml(t('brandName') || 'Brand/Product Name')}</th>
        <th>${escapeHtml(t('sku') || 'SKU')}</th>
        <th class="text-right">${escapeHtml(t('quantity'))}</th>
        <th class="text-right">${escapeHtml(t('unitPrice'))} (${currencyLabel})</th>
        <th class="text-right">${escapeHtml(t('totalPrice'))} (${currencyLabel})</th>
      </tr>
    </thead>
    <tbody>
      ${itemsWithImages.length > 0 ? itemsWithImages.map((item: any, index: number) => {
        const isMotorcycleItem = item.notes?.toUpperCase().trim().startsWith('MOTORCYCLE:')
        const isPaymentItem = item.notes?.toUpperCase().trim().startsWith('PAYMENT:')
        
        const imageCell = item.imageUrl 
          ? `<td class="text-center" style="padding: 4px;"><img src="${item.imageUrl}" alt="${escapeHtml(item.brandOrProductName || '')}" style="max-width: 40px; max-height: 40px; object-fit: contain;" /></td>`
          : `<td class="text-center" style="padding: 4px;">-</td>`
        
        const brandOrProductName = item.brandOrProductName || (isPaymentItem ? t('typePayment') : 'Unknown')
        const skuCode = item.sku || '-'
        
        return `
        <tr>
          <td class="text-center">${index + 1}</td>
          ${imageCell}
          <td>${escapeHtml(brandOrProductName)}</td>
          <td>${escapeHtml(skuCode)}</td>
          <td class="text-right">${item.quantity}</td>
          <td class="text-right">${currencySymbol}${item.unitPrice.toLocaleString('en-US', { minimumFractionDigits: isMotorcycle ? 2 : 0, maximumFractionDigits: 2 })}</td>
          <td class="text-right">${currencySymbol}${item.lineTotal.toLocaleString('en-US', { minimumFractionDigits: isMotorcycle ? 2 : 0, maximumFractionDigits: 2 })}</td>
        </tr>
      `
      }).join('') : `
        <tr>
          <td colspan="7" class="text-center">${escapeHtml(t('noItems'))}</td>
        </tr>
      `}
    </tbody>
  </table>
  
  ${invoice.customer ? `
  <h2 style="font-size: 12pt; margin-top: 20px; margin-bottom: 10px;">${escapeHtml(t('customerInformation'))}</h2>
  <div class="info-section">
    <div class="info-row">
      <span><strong>${escapeHtml(t('billTo'))}:</strong></span>
      <span>${escapeHtml(invoice.customer.name)}</span>
    </div>
    <div class="info-row">
      <span><strong>${escapeHtml(t('sku'))}:</strong></span>
      <span>${escapeHtml(invoice.customer.sku)}</span>
    </div>
    ${invoice.customer.email ? `
    <div class="info-row">
      <span><strong>${escapeHtml(t('email'))}:</strong></span>
      <span>${escapeHtml(invoice.customer.email)}</span>
    </div>
    ` : ''}
    ${invoice.customer.phone ? `
    <div class="info-row">
      <span><strong>${escapeHtml(t('phone'))}:</strong></span>
      <span>${escapeHtml(invoice.customer.phone)}</span>
    </div>
    ` : ''}
  </div>
  
  <h2 style="font-size: 12pt; margin-top: 20px; margin-bottom: 10px;">${escapeHtml(t('balanceBeforeInvoice'))}</h2>
  <div class="info-section">
    ${!isMotorcycle ? `
    <div class="info-row">
      <span><strong>${escapeHtml(t('debtIqdBefore'))}:</strong></span>
      <span>ع.د ${(invoice.customer.debtIqd - (invoice.total - invoice.amountPaid)).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
    </div>
    ` : ''}
    ${isMotorcycle ? `
    <div class="info-row">
      <span><strong>${escapeHtml(t('debtUsdBefore'))}:</strong></span>
      <span>$${(invoice.customer.debtUsd - (invoice.total - invoice.amountPaid)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
    </div>
    ` : ''}
    <div class="info-row" style="border-top: 1px solid #ddd; padding-top: 8px; font-weight: bold;">
      <span><strong>${escapeHtml(t('amountPaidForInvoice'))}:</strong></span>
      <span>${currencySymbol}${invoice.amountPaid.toLocaleString('en-US', { minimumFractionDigits: isMotorcycle ? 2 : 0, maximumFractionDigits: 2 })}</span>
    </div>
  </div>
  
  <h2 style="font-size: 12pt; margin-top: 20px; margin-bottom: 10px;">${escapeHtml(t('totalBalanceNow'))}</h2>
  <div class="info-section">
    <div class="info-row">
      <span><strong>${escapeHtml(t('debtIqdNow'))}:</strong></span>
      <span>ع.د ${invoice.customer.debtIqd.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
    </div>
    <div class="info-row">
      <span><strong>${escapeHtml(t('debtUsdNow'))}:</strong></span>
      <span>$${invoice.customer.debtUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
    </div>
  </div>
  ` : ''}
  
  <div class="footer">
    <p>${escapeHtml(t('invoiceInformation'))} - ${escapeHtml(invoice.invoiceNumber)}</p>
    <p>${currentDate}</p>
    <p style="margin-top: 10px; font-weight: bold;">${escapeHtml(t('thankYou'))}</p>
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

  // PDF generation function (same as in invoice-success-dialog)
  const generateInvoicePDF = async (invoice: any, invoiceNumber: string) => {
    const { jsPDF } = await import('jspdf')
    const autoTable = (await import('jspdf-autotable')).default
    const { format } = await import('date-fns')

    const doc = new jsPDF('p', 'mm', 'a4')
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 15
    let startY = margin

    // Determine currency
    const isMotorcycle = (() => {
      if (invoice.notes) {
        const notes = invoice.notes.toUpperCase()
        if (notes.includes('[INVOICE_TYPE:') && notes.includes('MOTORCYCLE')) {
          return true
        }
      }
      if (invoice.items && invoice.items.length > 0) {
        return invoice.items.some((item: any) => {
          if (!item.product && item.notes) {
            return item.notes.toUpperCase().trim().startsWith('MOTORCYCLE:')
          }
          const productName = item.product?.name?.toLowerCase() || ''
          return productName.includes('motorcycle')
        })
      }
      return false
    })()
    
    // Use text labels instead of symbols for PDF compatibility
    const currencySymbol = isMotorcycle ? '$' : 'ع.د '
    const currencyLabel = isMotorcycle ? 'USD' : 'ع.د'

    // Header with logo
    try {
      const logoUrl = '/assets/logo/arbati.png'
      const response = await fetch(logoUrl)
      const blob = await response.blob()
      const imgData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
      doc.addImage(imgData, 'PNG', margin, margin, 40, 15)
    } catch (error) {
      console.warn('Could not load logo:', error)
    }

    startY = margin + 20

    // Invoice Title
    doc.setFontSize(20)
    doc.setFont('helvetica', 'bold')
    doc.text('INVOICE', pageWidth / 2, startY, { align: 'center' })
    startY += 10

    // Invoice Number
    doc.setFontSize(14)
    doc.setFont('helvetica', 'normal')
    doc.text(`Invoice Number: ${invoiceNumber}`, pageWidth / 2, startY, { align: 'center' })
    startY += 8

    // Date
    const invoiceDate = invoice.invoiceDate ? format(new Date(invoice.invoiceDate), 'PP') : format(new Date(), 'PP')
    doc.setFontSize(10)
    doc.text(`Date: ${invoiceDate}`, pageWidth / 2, startY, { align: 'center' })
    startY += 15

    // Customer and Invoice Details (side by side)
    const leftX = margin
    const rightX = pageWidth - margin - 60

    // Customer Details - Show for both database customers and retail customers (from invoice number)
    // Extract customer name from invoice number for retail invoices (format: customerName-YYYY-MM-DD-RANDOMCODE)
    let customerName = invoice.customer?.name || null
    let customerSku = invoice.customer?.sku || null
    
    // If no customer in database, try to extract from invoice number (for retail)
    if (!customerName && invoiceNumber) {
      const parts = invoiceNumber.split('-')
      // Find the first part that looks like a year (4 digits starting with 19 or 20)
      const yearIndex = parts.findIndex(part => /^(19|20)\d{2}$/.test(part))
      if (yearIndex > 0) {
        // Take all parts before the year
        customerName = parts.slice(0, yearIndex).join('-')
      }
    }
    
    // Always show "Bill To:" section
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Bill To:', leftX, startY)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    startY += 6
    doc.text(customerName || 'Unknown', leftX, startY)
    
    if (customerSku) {
      startY += 5
      doc.text(`SKU: ${customerSku}`, leftX, startY)
    }
    
    if (invoice.customer?.phone) {
      startY += 5
      doc.text(`Phone: ${invoice.customer.phone}`, leftX, startY)
    }

    // Invoice Details (right side)
    let rightY = startY - (customerName ? 20 : 0)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Invoice Details:', rightX, rightY)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    rightY += 6
    doc.text(`${t('status')}: ${getStatusLabel(invoice.status)}`, rightX, rightY)
    rightY += 5
    if (invoice.sale?.paymentMethod) {
      doc.text(`${t('paymentMethod')}: ${getPaymentMethodLabel(invoice.sale.paymentMethod)}`, rightX, rightY)
      rightY += 5
    }
    if (invoice.dueDate) {
      doc.text(`${t('dueDate')}: ${format(new Date(invoice.dueDate), 'PP')}`, rightX, rightY)
      rightY += 5
    }

    startY = Math.max(startY, rightY) + 15

    // Items Table - use invoice.items or fallback to sale.items
    let invoiceItems: any[] = []
    if (invoice.items && invoice.items.length > 0) {
      invoiceItems = invoice.items
    } else if (invoice.sale?.items && invoice.sale.items.length > 0) {
      invoiceItems = invoice.sale.items
    }
    
    // Fetch motorcycle names and images if needed
    const tableData = await Promise.all(invoiceItems.map(async (item: any, index: number) => {
      // Get item name - check product first, then notes for motorcycle
      let itemName = 'N/A'
      let imageUrl: string | null = null
      
      if (item.product?.name) {
        itemName = item.product.name
        if (item.product.image) {
          imageUrl = item.product.image
        }
      } else if (item.notes) {
        // For motorcycles, extract from notes: MOTORCYCLE:id
        if (item.notes.toUpperCase().trim().startsWith('MOTORCYCLE:')) {
          const motorcycleId = item.notes.replace(/^MOTORCYCLE:/i, '').trim()
          if (motorcycleId) {
            try {
              // Try to fetch motorcycle name and image
              const motoResponse = await fetch(`/api/motorcycles/${motorcycleId}`)
              if (motoResponse.ok) {
                const motoData = await motoResponse.json()
                if (motoData.motorcycle) {
                  itemName = `${motoData.motorcycle.brand} ${motoData.motorcycle.model}`
                  if (motoData.motorcycle.image) {
                    imageUrl = motoData.motorcycle.image
                  }
                } else {
                  itemName = `Motorcycle ${motorcycleId.slice(0, 8)}`
                }
              } else {
                itemName = `Motorcycle ${motorcycleId.slice(0, 8)}`
              }
            } catch (error) {
              console.warn('Error fetching motorcycle for PDF:', error)
              itemName = `Motorcycle ${motorcycleId.slice(0, 8)}`
            }
          } else {
            itemName = 'Motorcycle'
          }
        } else {
          itemName = item.notes
        }
      }
      
      const quantity = Number(item.quantity) || 0
      const unitPrice = Number(item.unitPrice) || 0
      const lineTotal = Number(item.lineTotal) || (quantity * unitPrice)
      
      return {
        row: [
          (index + 1).toString(), // Item number: 1, 2, 3, etc.
          itemName,
          quantity.toString(),
          `${currencySymbol}${unitPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          `${currencySymbol}${lineTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        ],
        imageUrl
      }
    }))
    
    // Load images as base64 and add to table rows
    const finalTableData = await Promise.all(tableData.map(async (item: any) => {
      const row = [...item.row]
      
      // Try to load image if available
      if (item.imageUrl) {
        try {
          const imgResponse = await fetch(item.imageUrl)
          if (imgResponse.ok) {
            const blob = await imgResponse.blob()
            const base64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader()
              reader.onloadend = () => resolve(reader.result as string)
              reader.onerror = reject
              reader.readAsDataURL(blob)
            })
            // Insert image as data URL at the beginning of the row (after item number)
            row.splice(1, 0, { content: base64, rowSpan: 1 } as any)
          } else {
            // Insert empty cell if image fails to load
            row.splice(1, 0, '')
          }
        } catch (error) {
          console.warn('Error loading image for PDF:', error)
          row.splice(1, 0, '')
        }
      } else {
        // Insert empty cell if no image
        row.splice(1, 0, '')
      }
      
      return row
    }))
    
    if (finalTableData.length === 0) {
      console.warn('No items found for PDF generation')
      // Add a placeholder row if no items
      finalTableData.push(['1', '', 'No items', '0', `${currencySymbol}0.00`, `${currencySymbol}0.00`])
    }

    // Build table with images - custom rendering to include images
    const imageColumnWidth = 20
    const itemStartY = startY
    
    // Draw header manually
    doc.setFillColor(66, 66, 66)
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    let headerX = margin
    let headerY = itemStartY
    
    // Header row
    doc.rect(headerX, headerY - 6, 15, 7, 'F')
    doc.text('No', headerX + 7.5, headerY - 2, { align: 'center' })
    headerX += 15
    
    doc.rect(headerX, headerY - 6, imageColumnWidth, 7, 'F')
    doc.text('Image', headerX + imageColumnWidth / 2, headerY - 2, { align: 'center' })
    headerX += imageColumnWidth
    
    const itemNameWidth = pageWidth - margin * 2 - 15 - imageColumnWidth - 25 - 40 - 40
    doc.rect(headerX, headerY - 6, itemNameWidth, 7, 'F')
    doc.text('Item', headerX + itemNameWidth / 2, headerY - 2, { align: 'center' })
    headerX += itemNameWidth
    
    doc.rect(headerX, headerY - 6, 25, 7, 'F')
    doc.text('Qty', headerX + 12.5, headerY - 2, { align: 'center' })
    headerX += 25
    
    doc.rect(headerX, headerY - 6, 40, 7, 'F')
    doc.text(`Unit Price (${currencyLabel})`, headerX + 20, headerY - 2, { align: 'center' })
    headerX += 40
    
    doc.rect(headerX, headerY - 6, 40, 7, 'F')
    doc.text(`Total (${currencyLabel})`, headerX + 20, headerY - 2, { align: 'center' })
    
    let currentY = itemStartY + 1
    const rowHeight = 15
    
    // Draw data rows
    doc.setFillColor(255, 255, 255)
    doc.setTextColor(0, 0, 0)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    
    for (let i = 0; i < finalTableData.length; i++) {
      const row = finalTableData[i]
      const itemData = tableData[i]
      
      // Alternate row color
      if (i % 2 === 1) {
        doc.setFillColor(245, 245, 245)
      } else {
        doc.setFillColor(255, 255, 255)
      }
      
      let cellX = margin
      let cellY = currentY
      
      // No column
      doc.rect(cellX, cellY, 15, rowHeight, 'FD')
      doc.text(String(row[0]), cellX + 7.5, cellY + rowHeight / 2 + 2, { align: 'center' })
      cellX += 15
      
      // Image column
      doc.rect(cellX, cellY, imageColumnWidth, rowHeight, 'FD')
      if (itemData?.imageUrl && typeof row[1] === 'string' && row[1].startsWith('data:')) {
        try {
          // Extract base64 data
          const base64Data = row[1].split(',')[1]
          const imageFormat = row[1].split(';')[0].split('/')[1]
          const format = imageFormat === 'png' ? 'PNG' : 'JPEG'
          
          // Calculate image size (fit within cell)
          const maxWidth = imageColumnWidth - 2
          const maxHeight = rowHeight - 2
          
          doc.addImage(base64Data, format, cellX + 1, cellY + 1, maxWidth, maxHeight, undefined, 'FAST')
        } catch (error) {
          console.warn('Error adding image to PDF:', error)
        }
      }
      cellX += imageColumnWidth
      
      // Item name
      doc.rect(cellX, cellY, itemNameWidth, rowHeight, 'FD')
      doc.text(String(row[2] || row[1]), cellX + 2, cellY + rowHeight / 2 + 2, { maxWidth: itemNameWidth - 4 })
      cellX += itemNameWidth
      
      // Quantity
      doc.rect(cellX, cellY, 25, rowHeight, 'FD')
      doc.text(String(row[3] || row[2]), cellX + 12.5, cellY + rowHeight / 2 + 2, { align: 'center' })
      cellX += 25
      
      // Unit Price
      doc.rect(cellX, cellY, 40, rowHeight, 'FD')
      doc.text(String(row[4] || row[3]), cellX + 38, cellY + rowHeight / 2 + 2, { align: 'right' })
      cellX += 40
      
      // Total
      doc.rect(cellX, cellY, 40, rowHeight, 'FD')
      doc.text(String(row[5] || row[4]), cellX + 38, cellY + rowHeight / 2 + 2, { align: 'right' })
      
      currentY += rowHeight
      
      // Check if we need a new page
      if (currentY > pageHeight - margin - 30) {
        doc.addPage()
        currentY = margin
      }
    }
    
    startY = currentY + 10

    const finalY = (doc as any).lastAutoTable.finalY || startY + 50

    // Customer Balance Information
    let balanceY = finalY + 10
    const balanceX = pageWidth - margin - 60
    
    // Calculate balance before this invoice
    // For retail invoices without customers, balance is always 0
    // Current debt includes this invoice's amountDue, so subtract it to get balance before
    const currentDebt = invoice.customer 
      ? (isMotorcycle 
          ? (invoice.customer.debtUsd || 0)
          : (invoice.customer.debtIqd || 0))
      : 0 // Retail invoices without customers have no debt
    const amountDue = Number(invoice.amountDue || 0)
    const balanceBefore = invoice.customer ? (currentDebt - amountDue) : 0
    
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Customer Balance Information:', balanceX, balanceY, { align: 'right' })
    balanceY += 8
    
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text('Balance Before This Invoice:', balanceX, balanceY, { align: 'right' })
    doc.text(`${currencySymbol}${balanceBefore.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, pageWidth - margin, balanceY, { align: 'right' })
    balanceY += 10

    // Totals
    let totalsY = balanceY
    const totalsX = pageWidth - margin - 60

    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Invoice Summary:', totalsX, totalsY, { align: 'right' })
    totalsY += 8

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text('Subtotal:', totalsX, totalsY, { align: 'right' })
    doc.text(`${currencySymbol}${Number(invoice.subtotal || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, pageWidth - margin, totalsY, { align: 'right' })
    totalsY += 6

    if (invoice.discount && Number(invoice.discount) > 0) {
      doc.text('Discount:', totalsX, totalsY, { align: 'right' })
      doc.text(`${currencySymbol}${Number(invoice.discount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, pageWidth - margin, totalsY, { align: 'right' })
      totalsY += 6
    }

    if (invoice.taxAmount && Number(invoice.taxAmount) > 0) {
      doc.text('Tax:', totalsX, totalsY, { align: 'right' })
      doc.text(`${currencySymbol}${Number(invoice.taxAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, pageWidth - margin, totalsY, { align: 'right' })
      totalsY += 6
    }

    totalsY += 3
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Total:', totalsX, totalsY, { align: 'right' })
    doc.text(`${currencySymbol}${Number(invoice.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, pageWidth - margin, totalsY, { align: 'right' })
    totalsY += 8

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Amount Paid: ${currencySymbol}${Number(invoice.amountPaid || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, totalsX, totalsY, { align: 'right' })
    totalsY += 6
    doc.text(`Amount Due: ${currencySymbol}${Number(invoice.amountDue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, totalsX, totalsY, { align: 'right' })
    totalsY += 10

    // Total Balance Now
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Total Balance Now:', totalsX, totalsY, { align: 'right' })
    doc.text(`${currencySymbol}${currentDebt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, pageWidth - margin, totalsY, { align: 'right' })

    // Footer
    const footerY = pageHeight - margin
    doc.setFontSize(8)
    doc.setTextColor(100, 100, 100)
    doc.text('Thank you for your business!', pageWidth / 2, footerY, { align: 'center' })
    doc.setTextColor(0, 0, 0)

    // Save PDF
    doc.save(`invoice-${invoiceNumber}-${new Date().getTime()}.pdf`)
  }

  const initials = invoice.invoiceNumber.slice(0, 2).toUpperCase()

  return (
    <div className={cn("flex flex-col gap-6 px-4 md:px-6 lg:px-8 pb-8", fontClass)} style={{ direction } as React.CSSProperties}>
      {/* Header with Back Button and Actions */}
      <div className="flex items-center justify-between pt-4">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.push(`/${locale}/invoices`)}
            className={fontClass}
          >
            <IconArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className={cn("text-3xl font-bold", fontClass)}>
              {invoice.invoiceNumber}
            </h1>
            <p className={cn("text-sm text-muted-foreground mt-1", fontClass)}>
              {getTypeLabel()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={cn(statusColors[invoice.status] || 'bg-gray-100 text-gray-800', fontClass)}>
            {getStatusLabel(invoice.status)}
          </Badge>
          <Button
            variant="outline"
            onClick={handlePrint}
            className={fontClass}
          >
            <IconPrinter className="mr-2 h-4 w-4" />
            {t('print')}
          </Button>
          <Button
            variant="outline"
            onClick={handleEdit}
            className={fontClass}
          >
            <IconEdit className="mr-2 h-4 w-4" />
            {t('edit')}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className={cn("inline-flex w-auto h-auto", fontClass)}>
          <TabsTrigger value="overview" className={cn("px-4 py-2", fontClass)}>{t('overview')}</TabsTrigger>
          <TabsTrigger value="items" className={cn("px-4 py-2", fontClass)}>{t('items')}</TabsTrigger>
          {invoice.customer && <TabsTrigger value="customer" className={cn("px-4 py-2", fontClass)}>{t('customer')}</TabsTrigger>}
          <TabsTrigger value="activities" className={cn("px-4 py-2", fontClass)}>{t('activities')}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Invoice Icon/Info */}
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle className={fontClass}>{t('invoiceInfo')}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center gap-4">
                  <Avatar className="h-32 w-32">
                    <AvatarFallback className="text-2xl bg-blue-100 text-blue-800">
                      <IconFileText className="h-16 w-16" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-center space-y-1">
                    <p className={cn("text-lg font-semibold font-mono", fontClass)}>
                      {invoice.invoiceNumber}
                    </p>
                    <Badge className={cn(statusColors[invoice.status] || 'bg-gray-100 text-gray-800', fontClass)}>
                      {getStatusLabel(invoice.status)}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Details */}
            <div className="lg:col-span-2 space-y-6">
              {/* Invoice Information */}
              <Card>
                <CardHeader>
                  <CardTitle className={fontClass}>{t('invoiceInformation')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={cn("text-sm font-medium text-muted-foreground", fontClass)}>{t('invoiceNumber')}</label>
                      <p className={cn("mt-1 text-lg font-semibold font-mono", fontClass)}>{invoice.invoiceNumber}</p>
                    </div>
                    <div>
                      <label className={cn("text-sm font-medium text-muted-foreground", fontClass)}>{t('type')}</label>
                      <p className={cn("mt-1 text-sm font-medium", fontClass)}>
                        {getTypeLabel()}
                      </p>
                    </div>
                    <div>
                      <label className={cn("text-sm font-medium text-muted-foreground", fontClass)}>{t('invoiceDate')}</label>
                      <p className={cn("mt-1 text-sm", fontClass)}>
                        {format(new Date(invoice.invoiceDate), 'PPp')}
                      </p>
                    </div>
                    {invoice.dueDate && (
                      <div>
                        <label className={cn("text-sm font-medium text-muted-foreground", fontClass)}>{t('dueDate')}</label>
                        <p className={cn("mt-1 text-sm", fontClass)}>
                          {format(new Date(invoice.dueDate), 'PPp')}
                        </p>
                      </div>
                    )}
                    {invoice.paidAt && (
                      <div>
                        <label className={cn("text-sm font-medium text-muted-foreground", fontClass)}>{t('paidAt')}</label>
                        <p className={cn("mt-1 text-sm", fontClass)}>
                          {format(new Date(invoice.paidAt), 'PPp')}
                        </p>
                      </div>
                    )}
                    {invoice.sale?.paymentMethod && (
                      <div>
                        <label className={cn("text-sm font-medium text-muted-foreground", fontClass)}>{t('paymentMethod')}</label>
                        <p className={cn("mt-1 text-sm", fontClass)}>{getPaymentMethodLabel(invoice.sale.paymentMethod)}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Financial Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className={fontClass}>{t('financialSummary')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className={cn("text-sm text-muted-foreground", fontClass)}>{t('subtotal')} ({currencyLabel})</span>
                      <span className={cn("text-sm font-medium", fontClass)}>
                        {currencySymbol}{invoice.subtotal.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    {invoice.discount > 0 && (
                      <div className="flex justify-between items-center">
                        <span className={cn("text-sm text-muted-foreground", fontClass)}>{t('discount')}</span>
                        <span className={cn("text-sm font-medium text-green-600", fontClass)}>
                          -{currencySymbol}{invoice.discount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}
                    {invoice.taxAmount > 0 && (
                      <div className="flex justify-between items-center">
                        <span className={cn("text-sm text-muted-foreground", fontClass)}>{t('tax')}</span>
                        <span className={cn("text-sm font-medium", fontClass)}>
                          {currencySymbol}{invoice.taxAmount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}
                    <div className="border-t pt-3 flex justify-between items-center">
                      <span className={cn("text-lg font-semibold", fontClass)}>{t('total')} ({currencyLabel})</span>
                      <span className={cn("text-lg font-bold", fontClass)}>
                        {currencySymbol}{invoice.total.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="border-t pt-3 flex justify-between items-center">
                      <span className={cn("text-sm font-medium", fontClass)}>{t('amountPaid')}</span>
                      <span className={cn("text-sm font-semibold text-green-600", fontClass)}>
                        {currencySymbol}{invoice.amountPaid.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className={cn("text-sm font-medium", fontClass)}>{t('amountDue')}</span>
                      <span className={cn(
                        "text-sm font-semibold",
                        invoice.amountDue > 0 ? "text-destructive" : "text-green-600",
                        fontClass
                      )}>
                        {currencySymbol}{invoice.amountDue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Profile Information */}
              <Card>
                <CardHeader>
                  <CardTitle className={fontClass}>{t('profileInformation')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {invoice.createdBy && (
                      <div className="flex items-center gap-3">
                        <IconUser className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <label className={cn("text-sm font-medium text-muted-foreground", fontClass)}>{t('createdBy')}</label>
                          <p className={cn("text-sm", fontClass)}>
                            {invoice.createdBy.name || invoice.createdBy.email}
                          </p>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-3">
                      <IconCalendar className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <label className={cn("text-sm font-medium text-muted-foreground", fontClass)}>{t('createdAt')}</label>
                        <p className={cn("text-sm", fontClass)}>
                          {format(new Date(invoice.createdAt), 'PPp')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <IconCalendar className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <label className={cn("text-sm font-medium text-muted-foreground", fontClass)}>{t('lastUpdated')}</label>
                        <p className={cn("text-sm", fontClass)}>
                          {format(new Date(invoice.updatedAt), 'PPp')}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Items Tab */}
        <TabsContent value="items" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className={fontClass}>{t('invoiceItems')}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className={fontClass}>#</TableHead>
                    <TableHead className={fontClass}>{t('item')}</TableHead>
                    <TableHead className={cn("text-right", fontClass)}>{t('quantity')}</TableHead>
                    <TableHead className={cn("text-right", fontClass)}>{t('unitPrice')} ({currencyLabel})</TableHead>
                    <TableHead className={cn("text-right", fontClass)}>{t('discount')}</TableHead>
                    <TableHead className={cn("text-right", fontClass)}>{t('totalPrice')} ({currencyLabel})</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(() => {
                    // Use invoice.items first, fallback to sale.items
                    const itemsToDisplay = (invoice.items && invoice.items.length > 0) 
                      ? invoice.items 
                      : (invoice.sale?.items || [])
                    
                    if (!itemsToDisplay || itemsToDisplay.length === 0) {
                      return (
                    <TableRow>
                      <TableCell colSpan={6} className={cn("text-center text-muted-foreground py-8", fontClass)}>
                        {t('noItems')}
                      </TableCell>
                    </TableRow>
                      )
                    }
                    
                    return itemsToDisplay.map((item: any, index: number) => {
                      // Handle motorcycle items (stored in notes as MOTORCYCLE:motocycleId)
                      const isMotorcycleItem = item.notes?.toUpperCase().trim().startsWith('MOTORCYCLE:')
                      const isPaymentItem = item.notes?.toUpperCase().trim().startsWith('PAYMENT:')
                      let itemDisplayName = item.product?.name || (isPaymentItem ? t('typePayment') : 'Unknown Item')
                      let itemSku = item.product?.sku || null
                      
                      // For motorcycle items, use fetched motorcycle data
                      if (isMotorcycleItem && !item.product) {
                        const motorcycleId = item.notes?.replace(/^MOTORCYCLE:/i, '').trim() || ''
                        const motoData = motorcycleData[motorcycleId]
                        if (motoData) {
                          itemDisplayName = `${motoData.brand} ${motoData.model}`
                          itemSku = motoData.sku || motorcycleId
                        } else {
                          // Fallback if data not loaded yet
                          itemDisplayName = 'Motorcycle'
                          itemSku = motorcycleId || null
                        }
                      }
                      
                      return (
                        <TableRow key={item.id}>
                          <TableCell className={fontClass}>{index + 1}</TableCell>
                          <TableCell className={fontClass}>
                            <div>
                              <div className="font-medium">{itemDisplayName}</div>
                              {itemSku && (
                                <div className="text-xs text-muted-foreground font-mono">{itemSku}</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className={cn("text-right", fontClass)}>{item.quantity}</TableCell>
                          <TableCell className={cn("text-right", fontClass)}>
                            {currencySymbol}{item.unitPrice.toLocaleString('en-US', { minimumFractionDigits: isMotorcycle ? 2 : 0, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className={cn("text-right", fontClass)}>
                            {item.discount > 0 ? `${item.discount}%` : '-'}
                          </TableCell>
                          <TableCell className={cn("text-right font-medium", fontClass)}>
                            {currencySymbol}{item.lineTotal.toLocaleString('en-US', { minimumFractionDigits: isMotorcycle ? 2 : 0, maximumFractionDigits: 2 })}
                          </TableCell>
                        </TableRow>
                      )
                    })
                  })()}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Customer Tab */}
        {invoice.customer && (
          <TabsContent value="customer" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className={fontClass}>{t('customerInformation')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={cn("text-sm font-medium text-muted-foreground", fontClass)}>{t('name')}</label>
                    <p className={cn("mt-1 text-sm font-medium", fontClass)}>{invoice.customer.name}</p>
                  </div>
                  <div>
                    <label className={cn("text-sm font-medium text-muted-foreground", fontClass)}>{t('sku')}</label>
                    <p className={cn("mt-1 text-sm font-mono", fontClass)}>{invoice.customer.sku}</p>
                  </div>
                  {invoice.customer.email && (
                    <div>
                      <label className={cn("text-sm font-medium text-muted-foreground", fontClass)}>{t('email')}</label>
                      <p className={cn("mt-1 text-sm", fontClass)}>{invoice.customer.email}</p>
                    </div>
                  )}
                  {invoice.customer.phone && (
                    <div>
                      <label className={cn("text-sm font-medium text-muted-foreground", fontClass)}>{t('phone')}</label>
                      <p className={cn("mt-1 text-sm", fontClass)}>{invoice.customer.phone}</p>
                    </div>
                  )}
                  <div>
                    <label className={cn("text-sm font-medium text-muted-foreground", fontClass)}>{t('columns.debtIqd')}</label>
                    <p className={cn("mt-1 text-sm font-medium", invoice.customer.debtIqd > 0 && "text-destructive", fontClass)}>
                      ع.د {invoice.customer.debtIqd.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <label className={cn("text-sm font-medium text-muted-foreground", fontClass)}>{t('columns.debtUsd')}</label>
                    <p className={cn("mt-1 text-sm font-medium", invoice.customer.debtUsd > 0 && "text-destructive", fontClass)}>
                      ${invoice.customer.debtUsd.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
                <div className="pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => router.push(`/${locale}/customers/${invoice.customer!.id}`)}
                    className={fontClass}
                  >
                    {t('viewCustomerProfile')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Activities Tab */}
        <TabsContent value="activities" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className={fontClass}>{t('activities')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-4">
                  {/* Created Activity */}
                  {invoice.createdBy && (
                    <div className="flex items-start gap-4 pb-4 border-b">
                      <div className="flex-shrink-0">
                        <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                          <IconUser className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className={cn("text-sm font-medium", fontClass)}>
                            Invoice Created
                          </p>
                          <p className={cn("text-xs text-muted-foreground", fontClass)}>
                            {format(new Date(invoice.createdAt), 'PPp')}
                          </p>
                        </div>
                          <p className={cn("text-sm text-muted-foreground mt-1", fontClass)}>
                            {t('createdBy')} {invoice.createdBy.name || invoice.createdBy.email}
                          </p>
                          <p className={cn("text-xs text-muted-foreground mt-1", fontClass)}>
                            {t('invoiceNumber')}: {invoice.invoiceNumber}
                          </p>
                      </div>
                    </div>
                  )}
                  
                  {/* Updated Activity */}
                  {invoice.updatedAt && new Date(invoice.updatedAt).getTime() > new Date(invoice.createdAt).getTime() && (
                    <div className="flex items-start gap-4 pb-4 border-b">
                      <div className="flex-shrink-0">
                        <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                          <IconEdit className="h-5 w-5 text-green-600 dark:text-green-400" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className={cn("text-sm font-medium", fontClass)}>
                            {t('invoiceUpdated')}
                          </p>
                          <p className={cn("text-xs text-muted-foreground", fontClass)}>
                            {format(new Date(invoice.updatedAt), 'PPp')}
                          </p>
                        </div>
                        <p className={cn("text-sm text-muted-foreground mt-1", fontClass)}>
                          {t('lastModification')}
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {/* Status Changes */}
                  <div className="flex items-start gap-4 pb-4 border-b">
                    <div className="flex-shrink-0">
                      <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                        <IconFileText className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className={cn("text-sm font-medium", fontClass)}>
                          {t('currentStatus')}
                        </p>
                      </div>
                      <div className="mt-2">
                        <Badge className={cn(statusColors[invoice.status] || 'bg-gray-100 text-gray-800', fontClass)}>
                          {getStatusLabel(invoice.status)}
                        </Badge>
                      </div>
                      {invoice.paidAt && (
                        <p className={cn("text-xs text-muted-foreground mt-2", fontClass)}>
                          {t('paidAtLabel')}: {format(new Date(invoice.paidAt), 'PPp')}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {invoice.items.length === 0 && !invoice.createdBy && (
                    <div className={cn("text-sm text-muted-foreground text-center py-8", fontClass)}>
                      {t('noActivities')}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
