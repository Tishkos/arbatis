"use client"

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { getTextDirection } from '@/lib/i18n'
import { IconCheck, IconFileInvoice, IconPrinter, IconX } from '@tabler/icons-react'
import { format } from 'date-fns'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog-animated'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface InvoiceSuccessDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoiceNumber: string
  invoiceId?: string
  onCloseTab?: () => void // Callback to close the tab
}

export function InvoiceSuccessDialog({ 
  open, 
  onOpenChange, 
  invoiceNumber,
  invoiceId,
  onCloseTab
}: InvoiceSuccessDialogProps) {
  const params = useParams()
  const router = useRouter()
  const t = useTranslations('navigation.salesOptions')
  const locale = (params?.locale as string) || 'ku'
  const fontClass = locale === 'ku' ? 'font-kurdish' : 'font-engar'
  const direction = getTextDirection(locale as 'ku' | 'en' | 'ar')

  const handleGoToInvoices = () => {
    router.push(`/${locale}/invoices`)
    onOpenChange(false)
    if (onCloseTab) {
      setTimeout(() => onCloseTab(), 100) // Small delay to ensure navigation happens
    }
  }

  const handlePrintPDF = async () => {
    if (!invoiceId) {
      // If no invoice ID, just go to invoices list
      router.push(`/${locale}/invoices`)
      onOpenChange(false)
      if (onCloseTab) {
        setTimeout(() => onCloseTab(), 100)
      }
      return
    }

    // Navigate to invoice details page where user can press چاپکردن (Print) button
    router.push(`/${locale}/invoices/${invoiceId}`)
    onOpenChange(false)
    if (onCloseTab) {
      setTimeout(() => onCloseTab(), 100)
    }
  }

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
                itemName = `${motoData.motorcycle.brand || ''} ${motoData.motorcycle.model || ''}`.trim() || `Motorcycle ${motorcycleId.slice(0, 8)}`
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
          // Convert relative URL to absolute URL for server-side fetch
          // Note: This runs in browser, so we can use window.location
          const absoluteImageUrl = item.imageUrl.startsWith('http') 
            ? item.imageUrl 
            : `${typeof window !== 'undefined' ? window.location.origin : ''}${item.imageUrl.startsWith('/') ? item.imageUrl : '/' + item.imageUrl}`
          
          const imgResponse = await fetch(absoluteImageUrl)
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

    // Items table with images - custom rendering to include images
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
    
    const itemNameWidth = pageWidth - margin * 2 - 10 - imageColumnWidth - 25 - 20 - 35 - 35
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
    
    // Amount Paid row
    if (invoice.amountPaid > 0) {
      doc.setFillColor(255, 255, 255)
      doc.rect(margin, nextRowY, footerTableWidth, 8, 'FD')
      doc.setFont('helvetica', 'bold')
      doc.text(`${t('amountPaid') || 'Amount Paid'}:`, margin + 5, nextRowY + 5.5)
      doc.setFont('helvetica', 'normal')
      doc.text(`${currencySymbol}${invoice.amountPaid.toLocaleString('en-US', { minimumFractionDigits: isMotorcycle ? 2 : 0, maximumFractionDigits: 2 })}`, pageWidth - margin - 5, nextRowY + 5.5, { align: 'right' })
      nextRowY += 8
    }
    
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

  const handleStayInSales = () => {
    onOpenChange(false)
    if (onCloseTab) {
      onCloseTab()
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent 
        className={cn("!max-w-[600px] w-[95vw] sm:w-full", fontClass)} 
        style={{ direction } as React.CSSProperties}
      >
        <AlertDialogHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="h-16 w-16 rounded-full bg-green-500 flex items-center justify-center">
              <IconCheck className="h-8 w-8 text-white" />
            </div>
          </div>
          <AlertDialogTitle 
            className={cn(direction === 'rtl' && 'text-right', fontClass, "text-xl text-center")}
            style={{ direction } as React.CSSProperties}
          >
            {t('invoiceSubmittedSuccessfully', { invoiceNumber: invoiceNumber || 'N/A' })}
          </AlertDialogTitle>
          <div className="mt-4 text-center space-y-3">
            <div className="flex items-center justify-center gap-2">
              <IconFileInvoice className="h-5 w-5 text-muted-foreground" />
              <span className={cn("font-semibold text-lg", fontClass)}>{t('invoiceNumber')}</span>
            </div>
            <div className="bg-muted rounded-lg p-4 border-2 border-primary/20 break-words overflow-wrap-anywhere">
              <span className={cn("text-xl sm:text-2xl font-bold text-primary break-words", fontClass)} style={{ wordBreak: 'break-all' }}>
                {invoiceNumber}
              </span>
            </div>
          </div>
        </AlertDialogHeader>

        <AlertDialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            onClick={handleStayInSales}
            variant="outline"
            className={cn("w-full sm:w-auto order-3 sm:order-1", fontClass)}
            size="lg"
          >
            <IconX className={cn("h-4 w-4", direction === 'rtl' ? 'ml-2' : 'mr-2')} />
            {t('stayInSales')}
          </Button>
          <Button
            onClick={handlePrintPDF}
            variant="outline"
            className={cn("w-full sm:w-auto order-2", fontClass)}
            size="lg"
          >
            <IconPrinter className={cn("h-4 w-4", direction === 'rtl' ? 'ml-2' : 'mr-2')} />
            {t('printPdf')}
          </Button>
          <Button
            onClick={handleGoToInvoices}
            className={cn("w-full sm:w-auto bg-primary hover:bg-primary/90 order-1 sm:order-3", fontClass)}
            size="lg"
          >
            <IconFileInvoice className={cn("h-4 w-4", direction === 'rtl' ? 'ml-2' : 'mr-2')} />
            {t('goToInvoices')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

