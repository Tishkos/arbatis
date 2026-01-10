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
    let rightY = startY - (invoice.customer ? 20 : 0)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Invoice Details:', rightX, rightY)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    rightY += 6
    doc.text(`Status: ${invoice.status}`, rightX, rightY)
    rightY += 5
    if (invoice.dueDate) {
      doc.text(`Due Date: ${format(new Date(invoice.dueDate), 'PP')}`, rightX, rightY)
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
    
    console.log('Items for PDF table:', {
      invoiceItemsCount: invoice.items?.length || 0,
      saleItemsCount: invoice.sale?.items?.length || 0,
      finalItemsCount: invoiceItems.length,
      items: invoiceItems
    })
    
    // Fetch motorcycle names if needed
    const tableData = await Promise.all(invoiceItems.map(async (item: any, index: number) => {
      // Get item name - check product first, then notes for motorcycle
      let itemName = 'N/A'
      if (item.product?.name) {
        itemName = item.product.name
      } else if (item.notes) {
        // For motorcycles, extract from notes: MOTORCYCLE:id
        if (item.notes.toUpperCase().trim().startsWith('MOTORCYCLE:')) {
          const motorcycleId = item.notes.replace(/^MOTORCYCLE:/i, '').trim()
          if (motorcycleId) {
            try {
              // Try to fetch motorcycle name
              const motoResponse = await fetch(`/api/motorcycles/${motorcycleId}`)
              if (motoResponse.ok) {
                const motoData = await motoResponse.json()
                if (motoData.motorcycle) {
                  itemName = `${motoData.motorcycle.brand} ${motoData.motorcycle.model}`
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
      
      return [
        (index + 1).toString(), // Item number: 1, 2, 3, etc.
        itemName,
        quantity.toString(),
        `${currencySymbol}${unitPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        `${currencySymbol}${lineTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      ]
    }))
    
    if (tableData.length === 0) {
      console.warn('No items found for PDF generation')
      // Add a placeholder row if no items
      tableData.push(['1', 'No items', '0', `${currencySymbol}0.00`, `${currencySymbol}0.00`])
    }

    autoTable(doc, {
      startY: startY,
      head: [['No', 'Item', 'Quantity', `Unit Price (${currencyLabel})`, `Total (${currencyLabel})`]],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [66, 66, 66], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        0: { halign: 'center', cellWidth: 15 }, // "No" column
        1: { cellWidth: 'auto' }, // Item name
        2: { halign: 'center', cellWidth: 25 }, // Quantity
        3: { halign: 'right', cellWidth: 40 }, // Unit Price
        4: { halign: 'right', cellWidth: 40 } // Total
      }
    })

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

  const handleStayInSales = () => {
    onOpenChange(false)
    if (onCloseTab) {
      onCloseTab()
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent 
        className={cn("!max-w-[500px] w-[100vw]", fontClass)} 
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
            {t('invoiceSubmittedSuccessfully')}
          </AlertDialogTitle>
          <div className="mt-4 text-center space-y-3">
            <div className="flex items-center justify-center gap-2">
              <IconFileInvoice className="h-5 w-5 text-muted-foreground" />
              <span className={cn("font-semibold text-lg", fontClass)}>{t('invoiceNumber')}</span>
            </div>
            <div className="bg-muted rounded-lg p-4 border-2 border-primary/20">
              <span className={cn("text-2xl font-bold text-primary", fontClass)}>
                {invoiceNumber}
              </span>
            </div>
          </div>
        </AlertDialogHeader>

        <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            onClick={handleGoToInvoices}
            className={cn("w-full sm:flex-1 bg-primary hover:bg-primary/90", fontClass)}
            size="lg"
          >
            <IconFileInvoice className="h-4 w-4 mr-2" />
            {t('goToInvoices')}
          </Button>
          <Button
            onClick={handlePrintPDF}
            variant="outline"
            className={cn("w-full sm:flex-1", fontClass)}
            size="lg"
          >
            <IconPrinter className="h-4 w-4 mr-2" />
            {t('printPdf')}
          </Button>
          <Button
            onClick={handleStayInSales}
            variant="outline"
            className={cn("w-full sm:flex-1", fontClass)}
            size="lg"
          >
            <IconX className="h-4 w-4 mr-2" />
            {t('stayInSales')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

