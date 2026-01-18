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
  const [motorcycleData, setMotorcycleData] = useState<Record<string, { name: string; sku: string; category?: { name: string } | null }>>({})
  
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
  
  const currencySymbol = isMotorcycle ? '$' : 'د.ع '
    const currencyLabel = isMotorcycle ? 'USD' : 'د.ع'

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
      
      // Filter out invalid IDs (null, empty, etc.)
      const validMotorcycleIds = motorcycleIds.filter(id => id && id !== 'null' && id.trim() !== '')
      
      // Fetch all motorcycle details
      if (validMotorcycleIds.length > 0) {
        const fetchPromises = validMotorcycleIds.map(async (id) => {
          try {
            const response = await fetch(`/api/motorcycles/${id}`)
            if (response.ok) {
              const data = await response.json()
              if (data.motorcycle) {
                return { id, ...data.motorcycle }
              } else {
                console.warn(`Motorcycle ${id} not found in response`)
              }
            } else {
              console.warn(`Failed to fetch motorcycle ${id}: ${response.status} ${response.statusText}`)
            }
          } catch (error) {
            console.warn(`Error fetching motorcycle ${id}:`, error)
          }
          return null
        })
        
        const results = await Promise.all(fetchPromises)
        const newMotorcycleData: Record<string, { name: string; sku: string; category?: { name: string } | null }> = {}
        results.forEach((result) => {
          if (result) {
            newMotorcycleData[result.id] = {
              name: result.name || '',
              sku: result.sku || result.id,
              category: result.category || null
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

    const dir = isRTL ? 'rtl' : 'ltr'

    // Escape HTML
    const escapeHtml = (text: string) => {
      const div = document.createElement('div')
      div.textContent = text
      return div.innerHTML
    }

    // Load background image and convert to base64
    let backgroundImageDataUrl = ''
    try {
      const bgImageUrl = `${window.location.origin}/assets/print/printbackground.png`
      const bgImgResponse = await fetch(bgImageUrl)
      if (bgImgResponse.ok) {
        const blob = await bgImgResponse.blob()
        backgroundImageDataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onloadend = () => {
            if (reader.result) {
              resolve(reader.result as string)
            } else {
              reject(new Error('Failed to read background image'))
            }
          }
          reader.onerror = () => reject(new Error('FileReader error'))
          reader.readAsDataURL(blob)
        })
      }
    } catch (error) {
      console.warn('Error loading background image for print:', error)
    }

    // Extract 6-character code from invoice number (last part after last dash)
    const invoiceParts = invoice.invoiceNumber.split('-')
    const invoiceCode = invoiceParts[invoiceParts.length - 1] || invoice.invoiceNumber.slice(-6)

    // Format date as DD/MM/YYYY HH:MM AM/PM
    const invoiceDate = new Date(invoice.invoiceDate)
    const month = String(invoiceDate.getMonth() + 1).padStart(2, '0')
    const day = String(invoiceDate.getDate()).padStart(2, '0')
    const year = invoiceDate.getFullYear()
    const hours = invoiceDate.getHours()
    const minutes = String(invoiceDate.getMinutes()).padStart(2, '0')
    const ampm = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours % 12 || 12
    const formattedDate = `${day}/${month}/${year} ${displayHours}:${minutes} ${ampm}`

    // Get customer name and address
    let customerName = 'Unknown'
    let customerAddress = ''
    
    if (invoice.customer) {
      customerName = invoice.customer.name || 'Unknown'
      // Try to get address from customer - fetch full customer data if needed
      try {
        const customerResponse = await fetch(`/api/customers/${invoice.customer.id}`)
        if (customerResponse.ok) {
          const customerData = await customerResponse.json()
          // Handle address - it can be an object with { id, name } or a string
          const addr = customerData.address
          if (addr) {
            customerAddress = typeof addr === 'object' && addr !== null && addr.name 
              ? addr.name 
              : (typeof addr === 'string' ? addr : '')
          }
          if (!customerAddress) {
            customerAddress = customerData.phone || customerData.email || invoice.customer.phone || invoice.customer.email || ''
          }
        } else {
          const addr = (invoice.customer as any).address
          if (addr) {
            customerAddress = typeof addr === 'object' && addr !== null && addr.name 
              ? addr.name 
              : (typeof addr === 'string' ? addr : '')
          }
          if (!customerAddress) {
            customerAddress = invoice.customer.phone || invoice.customer.email || ''
          }
        }
      } catch (error) {
        const addr = (invoice.customer as any).address
        if (addr) {
          customerAddress = typeof addr === 'object' && addr !== null && addr.name 
            ? addr.name 
            : (typeof addr === 'string' ? addr : '')
        }
        if (!customerAddress) {
          customerAddress = invoice.customer.phone || invoice.customer.email || ''
        }
      }
    } else {
      // Extract customer name from invoice number for retail invoices
      const parts = invoice.invoiceNumber.split('-')
      const yearIndex = parts.findIndex(part => /^(19|20)\d{2}$/.test(part))
      if (yearIndex > 0) {
        customerName = parts.slice(0, yearIndex).join('-')
      }
    }

    // Get items to display
    const itemsToDisplay = (invoice.items && invoice.items.length > 0) 
      ? invoice.items 
      : (invoice.sale?.items || [])

    // Fetch item details with images
    const origin = window.location.origin
    
    // Check if images exist before including them in HTML
    const itemsWithDetails = await Promise.all(itemsToDisplay.map(async (item: any) => {
      let sku: string | null = null
      let brandOrProductName: string | null = null
      let imageUrl: string | null = null
      let categoryName: string | null = null
      
      // Check if it's a product item
      if (item.product) {
        sku = item.product.sku || null
        brandOrProductName = item.product.name || null
        // Fetch category if productId exists
        const productIdToFetch = item.product.id || item.productId
        if (productIdToFetch) {
          try {
            const productResponse = await fetch(`${origin}/api/products/${productIdToFetch}`)
            if (productResponse.ok) {
              const productData = await productResponse.json()
              if (productData.product?.category) {
                categoryName = productData.product.category.nameKu || productData.product.category.nameAr || productData.product.category.name || null
              }
            }
          } catch (error) {
            // Failed to fetch category, leave as null
            console.warn('Failed to fetch category for product:', productIdToFetch, error)
          }
        }
        
        // Construct image path from product SKU (lowercase)
        // Format: http://localhost:3000/products/{sku}.jpg (e.g., f05a9j.jpg for SKU F05A9J)
        if (sku) {
          const skuCode = sku.toLowerCase().trim().replace(/[^a-z0-9]/g, '')
          const potentialImageUrl = origin + '/products/' + skuCode + '.jpg'
          
          // Check if image exists
          try {
            const imgResponse = await fetch(potentialImageUrl, { method: 'HEAD' })
            if (imgResponse.ok && imgResponse.status === 200) {
              imageUrl = potentialImageUrl
            }
          } catch (error) {
            // Image doesn't exist, leave imageUrl as null
          }
        }
      } 
      // Check if it's a motorcycle item
      else if (item.notes?.toUpperCase().trim().startsWith('MOTORCYCLE:')) {
        const motorcycleId = item.notes.replace(/^MOTORCYCLE:/i, '').trim()
        if (motorcycleId) {
          // Fetch motorcycle details from API
          try {
            const motorcycleResponse = await fetch(`${origin}/api/motorcycles/${motorcycleId}`)
            if (motorcycleResponse.ok) {
              const motorcycleData = await motorcycleResponse.json()
              if (motorcycleData.motorcycle) {
                const moto = motorcycleData.motorcycle
                sku = moto.sku || motorcycleId
                brandOrProductName = moto.name || `Motorcycle ${motorcycleId.slice(0, 8)}`
                // Fetch category name if available
                if (moto.category) {
                  categoryName = moto.category.name || null
                }
                
                // Construct motorcycle image path from SKU
                if (sku) {
                  const skuCode = sku.toLowerCase().trim().replace(/[^a-z0-9]/g, '')
                  const potentialImageUrl = origin + '/products/' + skuCode + '.jpg'
                  
                  // Check if image exists
                  try {
                    const imgResponse = await fetch(potentialImageUrl, { method: 'HEAD' })
                    if (imgResponse.ok && imgResponse.status === 200) {
                      imageUrl = potentialImageUrl
                    }
                  } catch (error) {
                    // Image doesn't exist, leave imageUrl as null
                  }
                }
              } else {
                // Motorcycle not found, use fallback
                sku = motorcycleId
                brandOrProductName = `Motorcycle ${motorcycleId.slice(0, 8)}`
              }
            } else {
              // Fetch failed, use fallback
              sku = motorcycleId
              brandOrProductName = `Motorcycle ${motorcycleId.slice(0, 8)}`
            }
          } catch (error) {
            // Fetch error, use fallback
            sku = motorcycleId
            brandOrProductName = `Motorcycle ${motorcycleId.slice(0, 8)}`
          }
        }
      } else if (item.notes?.toUpperCase().trim().startsWith('PAYMENT:')) {
        sku = 'PAYMENT'
        brandOrProductName = t('typePayment')
      } else {
        // If product is null but productId exists, try to fetch the product
        // This handles cases where product was deleted or relation is missing
        if (!item.product && item.productId) {
          try {
            const productResponse = await fetch(`${origin}/api/products/${item.productId}`)
            if (productResponse.ok) {
              const productData = await productResponse.json()
              if (productData.product) {
                sku = productData.product.sku || null
                brandOrProductName = productData.product.name || null
                if (productData.product.category) {
                  categoryName = productData.product.category.nameKu || productData.product.category.nameAr || productData.product.category.name || null
                }
                // Try to get image URL if SKU exists
                if (sku) {
                  const skuCode = sku.toLowerCase().trim().replace(/[^a-z0-9]/g, '')
                  const potentialImageUrl = origin + '/products/' + skuCode + '.jpg'
                  try {
                    const imgResponse = await fetch(potentialImageUrl, { method: 'HEAD' })
                    if (imgResponse.ok && imgResponse.status === 200) {
                      imageUrl = potentialImageUrl
                    }
                  } catch (error) {
                    // Image doesn't exist
                  }
                }
              }
            }
          } catch (error) {
            // Failed to fetch product, leave as null
          }
        }
        // If still no name, use a better fallback
        if (!brandOrProductName) {
          brandOrProductName = item.notes || (item.productId ? `Item ${item.productId.slice(0, 8)}` : 'Unknown Item')
        }
      }
      
      return { ...item, sku, brandOrProductName, imageUrl, categoryName }
    }))

    // Calculate previous balance (balance before this invoice)
    const currentDebt = invoice.customer 
      ? (isMotorcycle 
          ? (invoice.customer.debtUsd || 0)
          : (invoice.customer.debtIqd || 0))
      : 0
    const amountDue = Number(invoice.amountDue || 0)
    const previousBalance = invoice.customer ? (currentDebt - amountDue) : 0
    const totalBalanceNow = currentDebt

    // Get invoicer name
    const invoicerName = invoice.createdBy?.name || invoice.createdBy?.email || ''

    const printContent = `
<!DOCTYPE html>
<html lang="${locale}" dir="${dir}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice - ${escapeHtml(invoiceCode)}</title>
  <style>
    @page {
      size: A4;
      margin: 0;
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
      font-size: 10pt;
      color: #000;
      margin: 0;
      padding: 0;
    }
    
    .invoice-container {
      width: 210mm;
      position: relative;
      margin: 0;
      padding: 0;
    }
    
    .first-page-header {
      width: 100%;
      height: 63mm;
      position: relative;
      background-image: ${backgroundImageDataUrl ? `url('${backgroundImageDataUrl}')` : 'none'};
      background-size: cover;
      background-position: top center;
      background-repeat: no-repeat;
      margin: 0;
      padding: 0;
      page-break-after: avoid;
    }
    
    .customer-fields {
      position: absolute;
      width: 100%;
      height: 100%;
      top: 0;
      left: 0;
      pointer-events: none;
    }
    
    .field-box {
      position: absolute;
      background-color: transparent;
      padding: 10px 12px;
      min-height: 38px;
      display: flex;
      align-items: center;
      font-weight: 600;
      font-size: 11pt;
      pointer-events: auto;
    }
    
    /* Individual field positioning - you can adjust these values */
    .field-customer-name {
      bottom: 09.5mm;
      right: 35mm;
      width: 70mm;
    }
    
    .field-customer-address {
      bottom: -1.5mm;
      right: 35mm;
      width: 70mm;
    }
    
    .field-invoice-date {
        bottom: 09.5mm;
      left: 8mm;
      width: 70mm;
    }
    
    .field-invoice-code {
       bottom: -1.5mm;
      left: 8mm;
      width: 70mm;
    }
    
    .content-area {
      padding: 0 10mm 10mm 10mm;
      margin-top: ${backgroundImageDataUrl ? '0' : '15mm'};
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: ${backgroundImageDataUrl ? '3mm' : '10mm'};
      margin-bottom: 3mm;
      table-layout: fixed;
      font-size: 8.5pt;
    }
    
    thead {
      display: table-header-group;
      background-color: #224880 !important;
      color: #FFFFFF;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      color-adjust: exact;
    }
    
    thead tr {
      page-break-after: avoid;
    }
    
    tbody {
      display: table-row-group;
    }
    
    tbody tr {
      page-break-inside: auto;
    }
    
    tbody tr:nth-child(odd) {
      background-color: #f5f5f5;
    }
    
    tbody tr:nth-child(even) {
      background-color: #FFFFFF;
    }
    
    th {
      padding: 6px 5px;
      text-align: ${isRTL ? 'right' : 'left'};
      border: 1px solid #C8C8C8;
      font-weight: bold;
      font-size: 8.5pt;
      vertical-align: middle;
      background-color: #224880 !important;
      color: #FFFFFF;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      color-adjust: exact;
    }
    
    td {
      padding: 4px 5px;
      border: 1px solid #C8C8C8;
      vertical-align: middle;
      font-size: 8pt;
      word-wrap: break-word;
    }
    
    .text-right {
      text-align: right;
    }
    
    .text-center {
      text-align: center;
    }
    
    .footer-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 5mm;
      page-break-inside: avoid;
      font-size: 8.5pt;
    }
    
    .footer-table td {
      padding: 5px 8px;
      border: 1px solid #C8C8C8;
      font-size: 8.5pt;
      background-color: #224880;
      color: #FFFFFF;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      color-adjust: exact;
    }
    
    .footer-table td:first-child {
      font-weight: bold;
      width: 50%;
    }
    
    .footer-table td:last-child {
      text-align: right;
    }
    
    @media print {
      body {
        padding: 0;
        margin: 0;
      }
      
      .invoice-container {
        page-break-after: auto;
      }
      
      .first-page-header {
        page-break-after: avoid;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
        color-adjust: exact;
      }
      
      .no-print {
        display: none;
      }
      
      table {
        page-break-inside: auto;
      }
      
      thead {
        display: table-header-group;
        background-color: #224880 !important;
        color: #FFFFFF !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }
      
      thead th {
        background-color: #224880 !important;
        color: #FFFFFF !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }
      
      th {
        color: #FFFFFF !important;
      }
      
      tbody tr {
        page-break-inside: auto;
        break-inside: auto;
      }
      
      tbody tr:nth-child(odd) {
        background-color: #f5f5f5 !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
        color-adjust: exact;
      }
      
      tbody tr:nth-child(even) {
        background-color: #FFFFFF !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
        color-adjust: exact;
      }
      
      .footer-table td {
        background-color: #224880 !important;
        color: #FFFFFF !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }
      
      img {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
        max-width: 100%;
        height: auto;
      }
      
      @page {
        margin-bottom: 3mm;
      }
      
      .print-footer {
        position: fixed;
        bottom: 1mm;
        left: 0;
        right: 0;
        padding: 0.5mm 10mm;
        font-size: 6.5pt;
        color: #666;
        text-align: center;
        background-color: transparent;
        z-index: 1000;
        line-height: 1.2;
      }
    }
    
    .print-footer {
      display: none;
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    ${backgroundImageDataUrl ? `
    <div class="first-page-header">
      <div class="customer-fields">
        <div class="field-box field-customer-name">${escapeHtml(customerName)}</div>
        <div class="field-box field-customer-address">${escapeHtml(customerAddress || '-')}</div>
        <div class="field-box field-invoice-date">${escapeHtml(formattedDate)}</div>
        <div class="field-box field-invoice-code">${escapeHtml(invoiceCode)}</div>
      </div>
    </div>
    ` : `
    <div style="padding: 15mm 10mm; padding-bottom: 0;">
      <div style="margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #000;">
        <div style="margin-bottom: 5px; font-size: 11pt;">
          <span style="font-weight: bold; display: inline-block; min-width: 120px;">${escapeHtml(t('customer') || 'Customer')}:</span>
          <span>${escapeHtml(customerName)}</span>
        </div>
        ${customerAddress ? `
        <div style="margin-bottom: 5px; font-size: 11pt;">
          <span style="font-weight: bold; display: inline-block; min-width: 120px;">${escapeHtml(t('address') || 'Address')}:</span>
          <span>${escapeHtml(customerAddress)}</span>
        </div>
        ` : ''}
        <div style="margin-bottom: 5px; font-size: 11pt;">
          <span style="font-weight: bold; display: inline-block; min-width: 120px;">${escapeHtml(t('invoiceDate') || 'Date')}:</span>
          <span>${escapeHtml(formattedDate)}</span>
        </div>
        <div style="margin-bottom: 5px; font-size: 11pt;">
          <span style="font-weight: bold; display: inline-block; min-width: 120px;">${escapeHtml(t('invoiceNumber') || 'Invoice')}:</span>
          <span>${escapeHtml(invoiceCode)}</span>
        </div>
      </div>
    </div>
    `}
    <div class="content-area">
      <!-- Items Table -->
      <table>
        <thead>
          <tr>
            <th style="width: 6%;">#</th>
            <th style="width: 8%;">${escapeHtml((() => {
              try {
                const translation = t('image')
                if (translation && !translation.includes('navigation.invoiceDetail') && !translation.includes('image')) {
                  return translation
                }
              } catch (e) {}
              return locale === 'ku' ? 'وێنە' : locale === 'ar' ? 'صورة' : 'Image'
            })())}</th>
            <th style="width: 28%;">${escapeHtml(t('brandName') || 'Product Name')}</th>
            <th style="width: 12%;">${escapeHtml((() => {
              try {
                const translation = t('category')
                if (translation && !translation.includes('navigation.invoiceDetail') && !translation.includes('category')) {
                  return translation
                }
              } catch (e) {}
              return locale === 'ku' ? 'پۆل' : locale === 'ar' ? 'فئة' : 'Category'
            })())}</th>
            <th style="width: 8%;" class="text-right">${escapeHtml(t('quantity') || 'Qty')}</th>
            <th style="width: 20%;" class="text-right">${escapeHtml(t('unitPrice') || 'Unit Price')} (${currencyLabel})</th>
            <th style="width: 20%;" class="text-right">${escapeHtml(t('totalPrice') || 'Total')} (${currencyLabel})</th>
          </tr>
        </thead>
        <tbody>
          ${itemsWithDetails.length > 0 ? itemsWithDetails.map((item: any, index: number) => {
            const brandOrProductName = item.brandOrProductName || 'Unknown'
            const skuCode = item.sku || '-'
            const imageCell = item.imageUrl 
              ? `<td class="text-center" style="padding: 2px; width: 30px; height: 30px; min-width: 30px; max-width: 30px; min-height: 30px; max-height: 30px; vertical-align: middle;"><img src="${item.imageUrl}" alt="${escapeHtml(brandOrProductName)}" style="max-width: 25px; max-height: 25px; width: 25px; height: 25px; object-fit: contain; display: block; margin: 0 auto; -webkit-print-color-adjust: exact; print-color-adjust: exact;" onerror="this.parentElement.innerHTML='<span style=\\'display: inline-block; width: 25px; height: 25px; line-height: 25px;\\'>-</span>';" /></td>`
              : `<td class="text-center" style="padding: 2px; width: 30px; height: 30px; min-width: 30px; max-width: 30px; min-height: 30px; max-height: 30px; vertical-align: middle;"><span style="display: inline-block; width: 25px; height: 25px; line-height: 25px;">-</span></td>`
            
            return `
            <tr>
              <td class="text-center">${index + 1}</td>
              ${imageCell}
              <td>${escapeHtml(brandOrProductName)}</td>
              <td>${escapeHtml(item.categoryName || '-')}</td>
              <td class="text-right">${item.quantity}</td>
              <td class="text-right">${item.unitPrice.toLocaleString('en-US', { minimumFractionDigits: isMotorcycle ? 2 : 0, maximumFractionDigits: 2 })} ${currencySymbol}</td>
              <td class="text-right">${item.lineTotal.toLocaleString('en-US', { minimumFractionDigits: isMotorcycle ? 2 : 0, maximumFractionDigits: 2 })} ${currencySymbol}</td>
            </tr>
          `
          }).join('') : `
            <tr>
              <td colspan="7" class="text-center">${escapeHtml(t('noItems'))}</td>
            </tr>
          `}
        </tbody>
      </table>
      
      <!-- Footer Table: Total of This Invoice, Amount Paid, Previous Balance, Total Balance Now -->
      <table class="footer-table">
        <tbody>
          <tr>
            <td>${escapeHtml(t('totalOfThisInvoice') || t('subtotal') || 'Total of This Invoice')}:</td>
            <td>${invoice.subtotal.toLocaleString('en-US', { minimumFractionDigits: isMotorcycle ? 2 : 0, maximumFractionDigits: 2 })} ${currencySymbol}</td>
          </tr>
          <tr>
            <td>${escapeHtml(t('amountPaid') || 'Amount Paid')}:</td>
            <td>${(invoice.amountPaid || 0).toLocaleString('en-US', { minimumFractionDigits: isMotorcycle ? 2 : 0, maximumFractionDigits: 2 })} ${currencySymbol}</td>
          </tr>
          ${invoice.customer ? `
          <tr>
            <td>${escapeHtml(t('balanceBeforeInvoice') || 'Previous Balance')}:</td>
            <td>${previousBalance.toLocaleString('en-US', { minimumFractionDigits: isMotorcycle ? 2 : 0, maximumFractionDigits: 2 })} ${currencySymbol}</td>
          </tr>
          <tr style="border-top: 2px solid #FFFFFF; font-weight: bold;">
            <td>${escapeHtml(t('totalBalanceNow') || 'Total Balance Now')}:</td>
            <td>${totalBalanceNow.toLocaleString('en-US', { minimumFractionDigits: isMotorcycle ? 2 : 0, maximumFractionDigits: 2 })} ${currencySymbol}</td>
          </tr>
          ` : ''}
        </tbody>
      </table>
    </div>
  </div>
  
  <div class="print-footer">
    <span>لاپەڕەی <span class="page-number">1</span>/<span class="total-pages">1</span></span>${invoicerName ? ` <span style="color: #999; margin-left: 10px;">${escapeHtml(invoicerName)}</span>` : ''}
  </div>
  
  <script>
    window.onload = function() {
      // Calculate total pages (approximate)
      const totalPages = Math.max(1, Math.ceil(document.body.scrollHeight / 1123)); // A4 height in pixels at 96dpi
      
      // Update page numbers
      document.querySelectorAll('.total-pages').forEach(el => {
        el.textContent = String(totalPages);
      });
      
      // Add print styles for footer
      const style = document.createElement('style');
      style.textContent = \`
        @media print {
          .print-footer {
            display: block !important;
          }
          
          @page {
            margin-bottom: 3mm;
          }
        }
      \`;
      document.head.appendChild(style);
      
      setTimeout(function() {
        window.print();
      }, 600);
    };
  </script>
</body>
</html>
    `
    
    printWindow.document.write(printContent)
    printWindow.document.close()
    printWindow.focus()
  }

  // PDF generation function - simplified version
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
    const currencySymbol = isMotorcycle ? '$' : 'د.ع '
    const currencyLabel = isMotorcycle ? 'USD' : 'د.ع'

    // Extract 6-character code from invoice number
    const invoiceParts = invoiceNumber.split('-')
    const invoiceCode = invoiceParts[invoiceParts.length - 1] || invoiceNumber.slice(-6)

    // Format date as DD/MM/YYYY HH:MM AM/PM
    const invoiceDate = new Date(invoice.invoiceDate)
    const month = String(invoiceDate.getMonth() + 1).padStart(2, '0')
    const day = String(invoiceDate.getDate()).padStart(2, '0')
    const year = invoiceDate.getFullYear()
    const hours = invoiceDate.getHours()
    const minutes = String(invoiceDate.getMinutes()).padStart(2, '0')
    const ampm = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours % 12 || 12
    const formattedDate = `${day}/${month}/${year} ${displayHours}:${minutes} ${ampm}`

    // Get customer name and address
    let customerName = 'Unknown'
    let customerAddress = ''
    
    if (invoice.customer) {
      customerName = invoice.customer.name || 'Unknown'
      // Try to get address from customer - fetch full customer data if needed
      try {
        const customerResponse = await fetch(`/api/customers/${invoice.customer.id}`)
        if (customerResponse.ok) {
          const customerData = await customerResponse.json()
          // Handle address - it can be an object with { id, name } or a string
          const addr = customerData.address
          if (addr) {
            customerAddress = typeof addr === 'object' && addr !== null && addr.name 
              ? addr.name 
              : (typeof addr === 'string' ? addr : '')
          }
          if (!customerAddress) {
            customerAddress = customerData.phone || customerData.email || invoice.customer.phone || invoice.customer.email || ''
          }
        } else {
          const addr = (invoice.customer as any).address
          if (addr) {
            customerAddress = typeof addr === 'object' && addr !== null && addr.name 
              ? addr.name 
              : (typeof addr === 'string' ? addr : '')
          }
          if (!customerAddress) {
            customerAddress = invoice.customer.phone || invoice.customer.email || ''
          }
        }
      } catch (error) {
        const addr = (invoice.customer as any).address
        if (addr) {
          customerAddress = typeof addr === 'object' && addr !== null && addr.name 
            ? addr.name 
            : (typeof addr === 'string' ? addr : '')
        }
        if (!customerAddress) {
          customerAddress = invoice.customer.phone || invoice.customer.email || ''
        }
      }
    } else {
      // Extract customer name from invoice number for retail invoices
      const parts = invoiceNumber.split('-')
      const yearIndex = parts.findIndex(part => /^(19|20)\d{2}$/.test(part))
      if (yearIndex > 0) {
        customerName = parts.slice(0, yearIndex).join('-')
      }
    }

    // Header: Customer Name, Address, Date, Invoice Code
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text(`${t('customer') || 'Customer'}:`, margin, startY)
    doc.setFont('helvetica', 'normal')
    doc.text(customerName, margin + 30, startY)
    startY += 6
    
    if (customerAddress) {
      doc.setFont('helvetica', 'bold')
      doc.text(`${t('address') || 'Address'}:`, margin, startY)
      doc.setFont('helvetica', 'normal')
      doc.text(customerAddress, margin + 30, startY)
      startY += 6
    }
    
    doc.setFont('helvetica', 'bold')
    doc.text(`${t('invoiceDate') || 'Date'}:`, margin, startY)
    doc.setFont('helvetica', 'normal')
    doc.text(formattedDate, margin + 30, startY)
    startY += 6
    
    doc.setFont('helvetica', 'bold')
    doc.text(`${t('invoiceNumber') || 'Invoice'}:`, margin, startY)
    doc.setFont('helvetica', 'normal')
    doc.text(invoiceCode, margin + 30, startY)
    startY += 15

    // Items Table - use invoice.items or fallback to sale.items
    let invoiceItems: any[] = []
    if (invoice.items && invoice.items.length > 0) {
      invoiceItems = invoice.items
    } else if (invoice.sale?.items && invoice.sale.items.length > 0) {
      invoiceItems = invoice.sale.items
    }
    
    // Fetch item details with images
    const tableDataWithImages = await Promise.all(invoiceItems.map(async (item: any, index: number) => {
      let itemName = 'N/A'
      let itemSku: string | null = null
      let imageUrl: string | null = null
      
      if (item.product) {
        itemName = item.product.name || 'Unknown Product'
        itemSku = item.product.sku || null
        imageUrl = item.product.image || null
      } else if (item.notes?.toUpperCase().trim().startsWith('MOTORCYCLE:')) {
        const motorcycleId = item.notes.replace(/^MOTORCYCLE:/i, '').trim()
        if (motorcycleId) {
          try {
            const motoResponse = await fetch(`/api/motorcycles/${motorcycleId}`)
            if (motoResponse.ok) {
              const motoData = await motoResponse.json()
              if (motoData.motorcycle) {
                itemName = motoData.motorcycle.name || `Motorcycle ${motorcycleId.slice(0, 8)}`
                itemSku = motoData.motorcycle.sku || motorcycleId
                imageUrl = motoData.motorcycle.image || null
              } else {
                itemName = `Motorcycle ${motorcycleId.slice(0, 8)}`
                itemSku = motorcycleId
              }
            } else {
              itemName = `Motorcycle ${motorcycleId.slice(0, 8)}`
              itemSku = motorcycleId
            }
          } catch (error) {
            console.warn('Error fetching motorcycle for PDF:', error)
            itemName = `Motorcycle ${motorcycleId.slice(0, 8)}`
            itemSku = motorcycleId
          }
        }
      } else if (item.notes?.toUpperCase().trim().startsWith('PAYMENT:')) {
        itemName = t('typePayment')
        itemSku = 'PAYMENT'
      }
      
      const quantity = Number(item.quantity) || 0
      const unitPrice = Number(item.unitPrice) || 0
      const lineTotal = Number(item.lineTotal) || (quantity * unitPrice)
      
      return {
        row: [
          (index + 1).toString(),
          itemName,
          itemSku || '-',
          quantity.toString(),
          `${currencySymbol}${unitPrice.toLocaleString('en-US', { minimumFractionDigits: isMotorcycle ? 2 : 0, maximumFractionDigits: 2 })}`,
          `${currencySymbol}${lineTotal.toLocaleString('en-US', { minimumFractionDigits: isMotorcycle ? 2 : 0, maximumFractionDigits: 2 })}`
        ],
        imageUrl
      }
    }))
    
    // Load images as base64 and add to table rows
    const tableData = await Promise.all(tableDataWithImages.map(async (item: any) => {
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
            // Insert image as data URL at position 1 (after item number)
            row.splice(1, 0, { content: base64, rowSpan: 1 } as any)
          } else {
            row.splice(1, 0, '')
          }
        } catch (error) {
          console.warn('Error loading image for PDF:', error)
          row.splice(1, 0, '')
        }
      } else {
        row.splice(1, 0, '')
      }
      
      return row
    }))
    
    if (tableData.length === 0) {
      tableData.push(['1', '', 'No items', '-', '0', `${currencySymbol}0.00`, `${currencySymbol}0.00`])
    }

    // Calculate previous balance and total balance now
    const currentDebt = invoice.customer 
      ? (isMotorcycle 
          ? (invoice.customer.debtUsd || 0)
          : (invoice.customer.debtIqd || 0))
      : 0
    const amountDue = Number(invoice.amountDue || 0)
    const previousBalance = invoice.customer ? (currentDebt - amountDue) : 0
    const totalBalanceNow = currentDebt

    // Items table with autoTable (with images, proper page breaks)
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
    doc.rect(headerX, headerY - 6, 10, 7, 'F')
    doc.text('#', headerX + 5, headerY - 2, { align: 'center' })
    headerX += 10
    
    doc.rect(headerX, headerY - 6, imageColumnWidth, 7, 'F')
    doc.text('Image', headerX + imageColumnWidth / 2, headerY - 2, { align: 'center' })
    headerX += imageColumnWidth
    
    const itemNameWidth = pageWidth - margin * 2 - 10 - imageColumnWidth - 25 - 35 - 35
    doc.rect(headerX, headerY - 6, itemNameWidth, 7, 'F')
    doc.text(t('brandName') || 'Product Name', headerX + itemNameWidth / 2, headerY - 2, { align: 'center' })
    headerX += itemNameWidth
    
    doc.rect(headerX, headerY - 6, 25, 7, 'F')
    doc.text(t('sku') || 'Code', headerX + 12.5, headerY - 2, { align: 'center' })
    headerX += 25
    
    doc.rect(headerX, headerY - 6, 20, 7, 'F')
    doc.text(t('quantity') || 'Qty', headerX + 10, headerY - 2, { align: 'center' })
    headerX += 20
    
    doc.rect(headerX, headerY - 6, 35, 7, 'F')
    doc.text(`Unit Price (${currencyLabel})`, headerX + 17.5, headerY - 2, { align: 'center' })
    headerX += 35
    
    doc.rect(headerX, headerY - 6, 35, 7, 'F')
    doc.text(`Total (${currencyLabel})`, headerX + 17.5, headerY - 2, { align: 'center' })
    
    let currentY = itemStartY + 1
    const rowHeight = 20
    
    // Draw data rows
    doc.setFillColor(255, 255, 255)
    doc.setTextColor(0, 0, 0)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    
    for (let i = 0; i < tableData.length; i++) {
      const row = tableData[i]
      const itemData = tableDataWithImages[i]
      
      // Alternate row color
      if (i % 2 === 1) {
        doc.setFillColor(245, 245, 245)
      } else {
        doc.setFillColor(255, 255, 255)
      }
      
      // Check if we need a new page
      if (currentY > pageHeight - margin - 50) {
        doc.addPage()
        currentY = margin
        // Redraw header on new page
        headerX = margin
        headerY = currentY
        doc.setFillColor(66, 66, 66)
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(9)
        doc.setFont('helvetica', 'bold')
        doc.rect(headerX, headerY - 6, 10, 7, 'F')
        doc.text('#', headerX + 5, headerY - 2, { align: 'center' })
        headerX += 10
        doc.rect(headerX, headerY - 6, imageColumnWidth, 7, 'F')
        doc.text('Image', headerX + imageColumnWidth / 2, headerY - 2, { align: 'center' })
        headerX += imageColumnWidth
        doc.rect(headerX, headerY - 6, itemNameWidth, 7, 'F')
        doc.text(t('brandName') || 'Product Name', headerX + itemNameWidth / 2, headerY - 2, { align: 'center' })
        headerX += itemNameWidth
        doc.rect(headerX, headerY - 6, 25, 7, 'F')
        doc.text(t('sku') || 'Code', headerX + 12.5, headerY - 2, { align: 'center' })
        headerX += 25
        doc.rect(headerX, headerY - 6, 20, 7, 'F')
        doc.text(t('quantity') || 'Qty', headerX + 10, headerY - 2, { align: 'center' })
        headerX += 20
        doc.rect(headerX, headerY - 6, 35, 7, 'F')
        doc.text(`Unit Price (${currencyLabel})`, headerX + 17.5, headerY - 2, { align: 'center' })
        headerX += 35
        doc.rect(headerX, headerY - 6, 35, 7, 'F')
        doc.text(`Total (${currencyLabel})`, headerX + 17.5, headerY - 2, { align: 'center' })
        currentY = headerY + 1
        doc.setFillColor(255, 255, 255)
        doc.setTextColor(0, 0, 0)
        doc.setFontSize(8)
        doc.setFont('helvetica', 'normal')
      }
      
      let cellX = margin
      let cellY = currentY
      
      // No column
      doc.rect(cellX, cellY, 10, rowHeight, 'FD')
      doc.text(String(row[0]), cellX + 5, cellY + rowHeight / 2 + 2, { align: 'center' })
      cellX += 10
      
      // Image column
      doc.rect(cellX, cellY, imageColumnWidth, rowHeight, 'FD')
      if (itemData?.imageUrl && typeof row[1] === 'object' && row[1].content) {
        try {
          const base64Data = row[1].content.split(',')[1]
          const imageFormat = row[1].content.split(';')[0].split('/')[1]
          const format = imageFormat === 'png' ? 'PNG' : 'JPEG'
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
      
      // SKU/Code
      doc.rect(cellX, cellY, 25, rowHeight, 'FD')
      doc.text(String(row[3] || row[2]), cellX + 12.5, cellY + rowHeight / 2 + 2, { align: 'center' })
      cellX += 25
      
      // Quantity
      doc.rect(cellX, cellY, 20, rowHeight, 'FD')
      doc.text(String(row[4] || row[3]), cellX + 10, cellY + rowHeight / 2 + 2, { align: 'center' })
      cellX += 20
      
      // Unit Price
      doc.rect(cellX, cellY, 35, rowHeight, 'FD')
      doc.text(String(row[5] || row[4]), cellX + 33, cellY + rowHeight / 2 + 2, { align: 'right' })
      cellX += 35
      
      // Total
      doc.rect(cellX, cellY, 35, rowHeight, 'FD')
      doc.text(String(row[6] || row[5]), cellX + 33, cellY + rowHeight / 2 + 2, { align: 'right' })
      
      currentY += rowHeight
    }
    
    const finalY = currentY + 10

    // Footer table: Total of This Invoice, Amount Paid, Previous Balance, Total Balance Now
    const footerTableY = finalY + 10
    const footerTableWidth = pageWidth - margin * 2
    
    // Draw footer table
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    
    // Total of This Invoice row
    doc.setFillColor(245, 245, 245)
    doc.rect(margin, footerTableY, footerTableWidth, 8, 'FD')
    doc.setFont('helvetica', 'bold')
    doc.text(`${t('totalOfThisInvoice') || t('subtotal') || 'Total of This Invoice'} (${currencyLabel}):`, margin + 5, footerTableY + 5.5)
    doc.setFont('helvetica', 'normal')
    doc.text(`${currencySymbol}${invoice.subtotal.toLocaleString('en-US', { minimumFractionDigits: isMotorcycle ? 2 : 0, maximumFractionDigits: 2 })}`, pageWidth - margin - 5, footerTableY + 5.5, { align: 'right' })
    
    let nextRowY = footerTableY + 8
    
    // Amount Paid row (always show, even if 0)
    doc.setFillColor(255, 255, 255)
    doc.rect(margin, nextRowY, footerTableWidth, 8, 'FD')
    doc.setFont('helvetica', 'bold')
    doc.text(`${t('amountPaid') || 'Amount Paid'}:`, margin + 5, nextRowY + 5.5)
    doc.setFont('helvetica', 'normal')
    doc.text(`${currencySymbol}${(invoice.amountPaid || 0).toLocaleString('en-US', { minimumFractionDigits: isMotorcycle ? 2 : 0, maximumFractionDigits: 2 })}`, pageWidth - margin - 5, nextRowY + 5.5, { align: 'right' })
    nextRowY += 8
    
    if (invoice.customer) {
      // Previous Balance row
      doc.setFillColor(255, 255, 255)
      doc.rect(margin, nextRowY, footerTableWidth, 8, 'FD')
      doc.setFont('helvetica', 'bold')
      doc.text(`${t('balanceBeforeInvoice') || 'Previous Balance'}:`, margin + 5, nextRowY + 5.5)
      doc.setFont('helvetica', 'normal')
      doc.text(`${currencySymbol}${previousBalance.toLocaleString('en-US', { minimumFractionDigits: isMotorcycle ? 2 : 0, maximumFractionDigits: 2 })}`, pageWidth - margin - 5, nextRowY + 5.5, { align: 'right' })
      nextRowY += 8
      
      // Total Balance Now row (bold border)
      doc.setFillColor(245, 245, 245)
      doc.rect(margin, nextRowY, footerTableWidth, 8, 'FD')
      doc.setDrawColor(0, 0, 0)
      doc.setLineWidth(0.5)
      doc.rect(margin, nextRowY, footerTableWidth, 8, 'D')
      doc.setFont('helvetica', 'bold')
      doc.text(`${t('totalBalanceNow') || 'Total Balance Now'}:`, margin + 5, nextRowY + 5.5)
      doc.text(`${currencySymbol}${totalBalanceNow.toLocaleString('en-US', { minimumFractionDigits: isMotorcycle ? 2 : 0, maximumFractionDigits: 2 })}`, pageWidth - margin - 5, nextRowY + 5.5, { align: 'right' })
    }

    // Save PDF
    doc.save(`invoice-${invoiceCode}-${new Date().getTime()}.pdf`)
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
                        // Skip if ID is invalid
                        if (motorcycleId && motorcycleId !== 'null' && motorcycleId.trim() !== '') {
                          const motoData = motorcycleData[motorcycleId]
                          if (motoData && motoData.name) {
                            itemDisplayName = motoData.name
                            itemSku = motoData.sku || motorcycleId
                          } else {
                            // Data might still be loading, show a better fallback
                            itemDisplayName = `Motorcycle (${motorcycleId.slice(0, 8)}...)`
                            itemSku = motorcycleId
                          }
                        } else {
                          // Invalid motorcycle ID
                          itemDisplayName = 'Motorcycle (Invalid ID)'
                          itemSku = null
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
                      د.ع {invoice.customer.debtIqd.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
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
                            {t('invoiceCreated')}
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
