"use client"

import { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { getTextDirection } from '@/lib/i18n'
import { IconPrinter, IconFileTypePdf, IconFileTypeXls, IconUpload, IconX, IconArrowLeft } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Checkbox } from '@/components/ui/checkbox'
import { Spinner } from '@/components/ui/spinner'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import * as React from 'react'

type Product = {
  id: string
  name: string
  sku: string
  mufradPrice: number | string
  jumlaPrice: number | string
  rmbPrice: number | string | null
  stockQuantity: number
  lowStockThreshold: number
  image: string | null
  category: {
    id: string
    name: string
  } | null
  createdAt: string | Date
}

const ALL_COLUMNS = [
  { id: 'image', label: 'Image' },
  { id: 'id', label: 'ID' },
  { id: 'name', label: 'Name' },
  { id: 'sku', label: 'SKU' },
  { id: 'category', label: 'Category' },
  { id: 'mufradPrice', label: 'Retail Price (IQD)' },
  { id: 'jumlaPrice', label: 'Wholesale Price (IQD)' },
  { id: 'rmbPrice', label: 'RMB Price (¥)' },
  { id: 'stockQuantity', label: 'Quantity' },
  { id: 'lowStockThreshold', label: 'Low Stock Threshold' },
]

export default function PrintProductsPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const locale = (params?.locale as string) || 'ku'
  const t = useTranslations('products.print')
  const fontClass = locale === 'ku' ? 'font-kurdish' : 'font-engar'
  const direction = getTextDirection(locale as 'ku' | 'en' | 'ar')
  
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [printScope, setPrintScope] = useState<'current' | 'all'>(searchParams.get('scope') === 'all' ? 'all' : 'current')
  const [format, setFormat] = useState<'pdf' | 'xlsx'>('pdf')
  const [paperSize, setPaperSize] = useState<'a4' | 'a5' | 'letter' | 'legal'>('a4')
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('landscape')
  const [selectedColumns, setSelectedColumns] = useState<string[]>(ALL_COLUMNS.map(c => c.id))
  const [isGenerating, setIsGenerating] = useState(false)
  
  // PDF styling options
  const [imageSize, setImageSize] = useState(20)
  const [imagePadding, setImagePadding] = useState(3)
  const [fontSize, setFontSize] = useState(9)
  const [cellPadding, setCellPadding] = useState(4)
  const [headerFontSize, setHeaderFontSize] = useState(10)
  
  // Header and Footer options
  const [headerType, setHeaderType] = useState<'logo' | 'cover' | 'date' | 'none' | 'custom'>('logo')
  const [customHeaderImage, setCustomHeaderImage] = useState<string | null>(null)
  const [customDate, setCustomDate] = useState<string>('')
  const [showPageNumbers, setShowPageNumbers] = useState(true)
  const [showFooter, setShowFooter] = useState(true)
  const [footerText, setFooterText] = useState('')
  
  // Advanced styling options
  const [headerBgColor, setHeaderBgColor] = useState('#424242')
  const [headerTextColor, setHeaderTextColor] = useState('#FFFFFF')
  const [borderColor, setBorderColor] = useState('#C8C8C8')
  const [borderWidth, setBorderWidth] = useState(0.1)
  const [rowStriping, setRowStriping] = useState(false)
  const [stripingColor, setStripingColor] = useState('#F5F5F5')

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true)
      try {
        const response = await fetch('/api/products?pageSize=10000')
        const data = await response.json()
        setProducts(data.products || [])
      } catch (error) {
        console.error('Error fetching products:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchProducts()
  }, [])

  const previewProducts = useMemo(() => {
    return products.slice(0, 10)
  }, [products])

  const handleColumnToggle = (columnId: string) => {
    setSelectedColumns(prev =>
      prev.includes(columnId)
        ? prev.filter(id => id !== columnId)
        : [...prev, columnId]
    )
  }

  const handleSelectAll = () => {
    setSelectedColumns(ALL_COLUMNS.map(c => c.id))
  }

  const handleDeselectAll = () => {
    setSelectedColumns([])
  }

  const handlePrint = async () => {
    if (selectedColumns.length === 0) {
      alert(t('selectColumnsAlert'))
      return
    }

    setIsGenerating(true)
    try {
      let productsToPrint = products

      if (printScope === 'current') {
        // Get current page products from URL or use all
        const pageParam = searchParams.get('page')
        const pageSizeParam = searchParams.get('pageSize') || '20'
        if (pageParam) {
          const page = parseInt(pageParam)
          const pageSize = parseInt(pageSizeParam)
          const start = (page - 1) * pageSize
          productsToPrint = products.slice(start, start + pageSize)
        }
      }

      if (format === 'pdf') {
        await generatePDF(
          productsToPrint, 
          selectedColumns, 
          paperSize, 
          orientation,
          imageSize,
          imagePadding,
          fontSize,
          cellPadding,
          headerFontSize,
          headerType,
          customHeaderImage,
          customDate,
          showPageNumbers,
          showFooter,
          footerText,
          headerBgColor,
          headerTextColor,
          borderColor,
          borderWidth,
          rowStriping,
          stripingColor,
          t
        )
      } else {
        await generateXLSX(productsToPrint, selectedColumns, t)
      }
    } catch (error) {
      console.error('Error generating print file:', error)
      alert(t('generationFailed'))
    } finally {
      setIsGenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col gap-6 px-4 lg:px-6 py-6", fontClass)} style={{ direction } as React.CSSProperties}>
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
          className={fontClass}
        >
          <IconArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className={cn("text-2xl font-semibold", fontClass)}>{t('title')}</h1>
          <p className={cn("text-sm text-muted-foreground", fontClass)}>{t('description')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Side - Settings */}
        <Card>
          <CardHeader>
            <CardTitle className={fontClass}>{t('settings')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
            {/* Print Scope */}
            <div className="space-y-3">
              <Label className={fontClass}>{t('print')}</Label>
              <RadioGroup value={printScope} onValueChange={(value: 'current' | 'all') => setPrintScope(value)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="current" id="current" />
                  <Label htmlFor="current" className={cn("font-normal cursor-pointer", fontClass)}>
                    {t('currentPage', { count: products.length })}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="all" id="all" />
                  <Label htmlFor="all" className={cn("font-normal cursor-pointer", fontClass)}>
                    {t('allProducts', { count: products.length })}
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Format Selection */}
            <div className="space-y-3">
              <Label className={fontClass}>{t('format')}</Label>
              <RadioGroup value={format} onValueChange={(value: 'pdf' | 'xlsx') => setFormat(value)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="pdf" id="pdf" />
                  <Label htmlFor="pdf" className={cn("font-normal cursor-pointer flex items-center gap-2", fontClass)}>
                    <IconFileTypePdf className="h-4 w-4" />
                    {t('pdf')}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="xlsx" id="xlsx" />
                  <Label htmlFor="xlsx" className={cn("font-normal cursor-pointer flex items-center gap-2", fontClass)}>
                    <IconFileTypeXls className="h-4 w-4" />
                    {t('excel')}
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Paper Size and Orientation (only for PDF) */}
            {format === 'pdf' && (
              <div className="space-y-3">
                <Label className={fontClass}>{t('paperSize')}</Label>
                <Select value={paperSize} onValueChange={(value: 'a4' | 'a5' | 'letter' | 'legal') => setPaperSize(value)}>
                  <SelectTrigger className={cn("w-full", fontClass)}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="a4">A4</SelectItem>
                    <SelectItem value="a5">A5</SelectItem>
                    <SelectItem value="letter">Letter</SelectItem>
                    <SelectItem value="legal">Legal</SelectItem>
                  </SelectContent>
                </Select>
                <Label className={fontClass}>{t('orientation')}</Label>
                <RadioGroup value={orientation} onValueChange={(value: 'portrait' | 'landscape') => setOrientation(value)}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="portrait" id="portrait" />
                    <Label htmlFor="portrait" className={cn("font-normal cursor-pointer", fontClass)}>
                      {t('portrait')}
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="landscape" id="landscape" />
                    <Label htmlFor="landscape" className={cn("font-normal cursor-pointer", fontClass)}>
                      {t('landscape')}
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            )}

            {/* Column Selection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className={fontClass}>{t('columns')}</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleSelectAll}
                    className={cn("h-7 text-xs", fontClass)}
                  >
                    {t('selectAll')}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleDeselectAll}
                    className={cn("h-7 text-xs", fontClass)}
                  >
                    {t('deselectAll')}
                  </Button>
                </div>
              </div>
              <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
                {ALL_COLUMNS.map(column => (
                  <div key={column.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={column.id}
                      checked={selectedColumns.includes(column.id)}
                      onCheckedChange={() => handleColumnToggle(column.id)}
                    />
                    <Label
                      htmlFor={column.id}
                      className={cn("font-normal cursor-pointer text-sm", fontClass)}
                    >
                      {t(`columns.${column.id}`)}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Print Button */}
            <Button
              onClick={handlePrint}
              disabled={isGenerating || selectedColumns.length === 0}
              className={cn("w-full", fontClass)}
              size="lg"
            >
              {isGenerating ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  {t('generating')}
                </>
              ) : (
                <>
                  <IconPrinter className="mr-2 h-4 w-4" />
                  {t('print')}
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Right Side - Preview */}
        <Card>
          <CardHeader>
            <CardTitle className={fontClass}>{t('preview')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className={cn("text-xs text-muted-foreground mb-3", fontClass)}>
                {printScope === 'current' ? t('showing', { count: previewProducts.length }) : t('willShow', { count: products.length })}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse" style={{ fontSize: `${fontSize}pt` }}>
                  <thead>
                    <tr className="bg-muted">
                      {ALL_COLUMNS
                        .filter(col => selectedColumns.includes(col.id))
                        .map(col => (
                          <th 
                            key={col.id} 
                            className={cn("border text-left font-semibold", fontClass)}
                            style={{ 
                              padding: `${cellPadding * 2}px`,
                              fontSize: `${headerFontSize}pt`
                            }}
                          >
                            {t(`columns.${col.id}`)}
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewProducts.map((product, idx) => (
                      <tr key={product.id || idx} className="border-b">
                        {selectedColumns.includes('image') && (
                          <td className="border" style={{ padding: `${imagePadding * 2}px`, width: `${(imageSize + imagePadding * 2) * 3.78}px` }}>
                            {product.image ? (
                              <img 
                                src={product.image} 
                                alt={product.name}
                                className="object-cover rounded"
                                style={{ 
                                  width: `${imageSize * 3.78}px`, 
                                  height: `${imageSize * 3.78}px`,
                                  display: 'block',
                                  margin: '0 auto'
                                }}
                              />
                            ) : (
                              <div 
                                className="bg-muted rounded" 
                                style={{ 
                                  width: `${imageSize * 3.78}px`, 
                                  height: `${imageSize * 3.78}px`,
                                  margin: '0 auto'
                                }}
                              ></div>
                            )}
                          </td>
                        )}
                        {selectedColumns.includes('id') && (
                          <td className={cn("border font-mono", fontClass)} style={{ padding: `${cellPadding * 2}px` }}>
                            {product.id.slice(0, 8)}...
                          </td>
                        )}
                        {selectedColumns.includes('name') && (
                          <td className={cn("border", fontClass)} style={{ padding: `${cellPadding * 2}px` }}>{product.name}</td>
                        )}
                        {selectedColumns.includes('sku') && (
                          <td className={cn("border font-mono", fontClass)} style={{ padding: `${cellPadding * 2}px` }}>{product.sku}</td>
                        )}
                        {selectedColumns.includes('category') && (
                          <td className={cn("border", fontClass)} style={{ padding: `${cellPadding * 2}px` }}>
                            {product.category?.name || '-'}
                          </td>
                        )}
                        {selectedColumns.includes('mufradPrice') && (
                          <td className={cn("border text-right", fontClass)} style={{ padding: `${cellPadding * 2}px` }}>
                            {typeof product.mufradPrice === 'number' 
                              ? product.mufradPrice.toLocaleString() 
                              : parseFloat(product.mufradPrice).toLocaleString()} IQD
                          </td>
                        )}
                        {selectedColumns.includes('jumlaPrice') && (
                          <td className={cn("border text-right", fontClass)} style={{ padding: `${cellPadding * 2}px` }}>
                            {typeof product.jumlaPrice === 'number' 
                              ? product.jumlaPrice.toLocaleString() 
                              : parseFloat(product.jumlaPrice).toLocaleString()} IQD
                          </td>
                        )}
                        {selectedColumns.includes('rmbPrice') && (
                          <td className={cn("border text-right", fontClass)} style={{ padding: `${cellPadding * 2}px` }}>
                            {product.rmbPrice 
                              ? (typeof product.rmbPrice === 'number' 
                                ? product.rmbPrice.toLocaleString() 
                                : parseFloat(product.rmbPrice).toLocaleString())
                              : '-'}
                          </td>
                        )}
                        {selectedColumns.includes('stockQuantity') && (
                          <td className={cn("border text-right", fontClass)} style={{ padding: `${cellPadding * 2}px` }}>
                            {product.stockQuantity}
                          </td>
                        )}
                        {selectedColumns.includes('lowStockThreshold') && (
                          <td className={cn("border text-right", fontClass)} style={{ padding: `${cellPadding * 2}px` }}>
                            {product.lowStockThreshold}
                          </td>
                        )}
                      </tr>
                    ))}
                    {previewProducts.length === 0 && (
                      <tr>
                        <td 
                          colSpan={selectedColumns.length} 
                          className={cn("border p-4 text-center text-muted-foreground", fontClass)}
                        >
                          {t('noProductsToPreview')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// Import generatePDF and generateXLSX functions from the dialog component
// For now, I'll include simplified versions here
async function generatePDF(
  products: Product[], 
  selectedColumns: string[], 
  paperSize: 'a4' | 'a5' | 'letter' | 'legal' = 'a4', 
  orientation: 'portrait' | 'landscape' = 'landscape',
  imageSize: number = 20,
  imagePadding: number = 3,
  fontSize: number = 9,
  cellPadding: number = 4,
  headerFontSize: number = 10,
  headerType: 'logo' | 'cover' | 'date' | 'none' | 'custom' = 'logo',
  customHeaderImage: string | null = null,
  customDate: string = '',
  showPageNumbers: boolean = true,
  showFooter: boolean = true,
  footerText: string = '',
  headerBgColor: string = '#424242',
  headerTextColor: string = '#FFFFFF',
  borderColor: string = '#C8C8C8',
  borderWidth: number = 0.1,
  rowStriping: boolean = false,
  stripingColor: string = '#F5F5F5',
  t: any
) {
  // This will be the same as the dialog version - I'll copy it from the dialog file
  const { jsPDF } = await import('jspdf')
  const autoTable = (await import('jspdf-autotable')).default

  const paperSizeMap: Record<string, string> = {
    'a4': 'a4',
    'a5': 'a5',
    'letter': 'letter',
    'legal': 'legal'
  }
  
  const orientationChar = orientation === 'landscape' ? 'l' : 'p'
  const pdfPaperSize = paperSizeMap[paperSize] || 'a4'
  const doc = new jsPDF(orientationChar, 'mm', pdfPaperSize as any)
  
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 10
  let startY = margin + 10

  const hexToRgb = (hex: string): [number, number, number] => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result
      ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
      : [66, 66, 66]
  }

  if (headerType === 'logo') {
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

      const logoWidth = 40
      const logoHeight = 15
      doc.addImage(imgData, 'PNG', margin, margin, logoWidth, logoHeight)
      startY = margin + logoHeight + 10
    } catch (error) {
      console.warn('Could not load logo:', error)
    }
  } else if (headerType === 'cover') {
    const headerHeight = 30
    const [r, g, b] = hexToRgb(headerBgColor)
    doc.setFillColor(r, g, b)
    doc.rect(0, 0, pageWidth, headerHeight, 'F')
    
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

      const logoWidth = 50
      const logoHeight = 18
      doc.addImage(imgData, 'PNG', margin, (headerHeight - logoHeight) / 2, logoWidth, logoHeight)
    } catch (error) {
      console.warn('Could not load logo:', error)
    }

    const [tr, tg, tb] = hexToRgb(headerTextColor)
    doc.setTextColor(tr, tg, tb)
    doc.setFontSize(24)
    doc.setFont('helvetica', 'bold')
    doc.text('Products List', pageWidth / 2, headerHeight / 2 + 3, { align: 'center' })
    doc.setTextColor(0, 0, 0)
    startY = headerHeight + 10
  } else if (headerType === 'date') {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 100)
    doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, margin, margin + 5)
    doc.setTextColor(0, 0, 0)
    startY = margin + 15
  } else if (headerType === 'custom') {
    if (customHeaderImage) {
      await new Promise<void>((resolve, reject) => {
        const img = new Image()
        img.onload = () => {
          try {
            const maxImageWidth = pageWidth - (margin * 2)
            const maxImageHeight = 40
            
            const aspectRatio = img.width / img.height
            let imageWidth = maxImageWidth
            let imageHeight = maxImageWidth / aspectRatio
            
            if (imageHeight > maxImageHeight) {
              imageHeight = maxImageHeight
              imageWidth = maxImageHeight * aspectRatio
            }
            
            const imageFormat = customHeaderImage.startsWith('data:image/png') ? 'PNG' : 'JPEG'
            doc.addImage(customHeaderImage, imageFormat, margin, margin, imageWidth, imageHeight)
            startY = margin + imageHeight + 5
            resolve()
          } catch (error) {
            console.warn('Error adding custom header image:', error)
            startY = margin + 10
            resolve()
          }
        }
        img.onerror = () => {
          console.warn('Could not load custom header image')
          startY = margin + 10
          resolve()
        }
        img.src = customHeaderImage
      })
    } else {
      startY = margin + 10
    }
    
    const dateText = customDate || new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 100)
    doc.text(`Generated: ${dateText}`, margin, startY)
    doc.setTextColor(0, 0, 0)
    startY = startY + 8
  }

  const headers = ALL_COLUMNS
    .filter(col => selectedColumns.includes(col.id))
    .map(col => t(`columns.${col.id}`))

  const imageMap = new Map<string, string | null>()
  if (selectedColumns.includes('image')) {
    const imagePromises = products
      .filter(p => p.image)
      .map(async (product) => {
        try {
          const response = await fetch(product.image!)
          const blob = await response.blob()
          const imgData = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result as string)
            reader.onerror = reject
            reader.readAsDataURL(blob)
          })
          return { productId: product.id, imgData }
        } catch (error) {
          console.warn(`Could not load image for product ${product.id}:`, error)
          return { productId: product.id, imgData: null }
        }
      })

    const imageResults = await Promise.all(imagePromises)
    imageResults.forEach(({ productId, imgData }) => {
      imageMap.set(productId, imgData)
    })
  }

  const rows = products.map((product) => {
    const row: (string | number)[] = []
    if (selectedColumns.includes('image')) {
      row.push('')
    }
    if (selectedColumns.includes('id')) row.push(product.id.slice(0, 8))
    if (selectedColumns.includes('name')) row.push(product.name)
    if (selectedColumns.includes('sku')) row.push(product.sku)
    if (selectedColumns.includes('category')) row.push(product.category?.name || 'No Category')
    if (selectedColumns.includes('mufradPrice')) {
      const price = typeof product.mufradPrice === 'number' ? product.mufradPrice : parseFloat(product.mufradPrice)
      row.push(price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
    }
    if (selectedColumns.includes('jumlaPrice')) {
      const price = typeof product.jumlaPrice === 'number' ? product.jumlaPrice : parseFloat(product.jumlaPrice)
      row.push(price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
    }
    if (selectedColumns.includes('rmbPrice')) {
      const price = product.rmbPrice ? (typeof product.rmbPrice === 'number' ? product.rmbPrice : parseFloat(product.rmbPrice)) : 0
      row.push(price ? price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-')
    }
    if (selectedColumns.includes('stockQuantity')) row.push(product.stockQuantity)
    if (selectedColumns.includes('lowStockThreshold')) row.push(product.lowStockThreshold)
    return row
  })

  const imageColumnIndex = selectedColumns.indexOf('image')
  const hasImageColumn = imageColumnIndex !== -1

  const [headerR, headerG, headerB] = hexToRgb(headerBgColor)
  const [textR, textG, textB] = hexToRgb(headerTextColor)
  const [borderR, borderG, borderB] = hexToRgb(borderColor)
  const [stripR, stripG, stripB] = hexToRgb(stripingColor)

  const tableWidth = orientation === 'portrait' ? pageWidth - (margin * 2) : 'wrap'
  const bottomMargin = (showFooter || showPageNumbers) ? margin + 10 : margin

  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: startY,
    styles: { 
      fontSize: fontSize,
      cellPadding: { top: cellPadding, bottom: cellPadding, left: cellPadding * 0.75, right: cellPadding * 0.75 },
      lineColor: [borderR, borderG, borderB],
      lineWidth: borderWidth,
      overflow: 'linebreak',
      cellWidth: orientation === 'portrait' ? 'wrap' : 'auto'
    },
    headStyles: { 
      fillColor: [headerR, headerG, headerB],
      textColor: [textR, textG, textB],
      fontStyle: 'bold',
      fontSize: headerFontSize,
      cellPadding: { top: cellPadding * 1.5, bottom: cellPadding * 1.5, left: cellPadding, right: cellPadding },
      lineColor: [borderR, borderG, borderB],
      lineWidth: borderWidth,
      overflow: 'linebreak',
      cellWidth: orientation === 'portrait' ? 'wrap' : 'auto'
    },
    alternateRowStyles: rowStriping ? {
      fillColor: [stripR, stripG, stripB]
    } : undefined,
    columnStyles: hasImageColumn ? {
      [imageColumnIndex]: {
        cellWidth: imageSize + (imagePadding * 2),
        minCellHeight: imageSize + (imagePadding * 2)
      }
    } : {},
    margin: { 
      top: startY,
      left: margin,
      right: margin,
      bottom: bottomMargin
    },
    tableWidth: typeof tableWidth === 'number' ? tableWidth : 'wrap',
    theme: 'grid',
    horizontalPageBreak: orientation === 'portrait',
    horizontalPageBreakRepeat: hasImageColumn ? imageColumnIndex : undefined,
    didDrawCell: (data: any) => {
      if (hasImageColumn && data.column.index === imageColumnIndex && data.section === 'body') {
        const rowIndex = data.row.index
        const product = products[rowIndex]
        if (product && product.image) {
          const imgData = imageMap.get(product.id)
          if (imgData) {
            try {
              const cellCenterX = data.cell.x + (data.cell.width / 2)
              const cellCenterY = data.cell.y + (data.cell.height / 2)
              const imageX = cellCenterX - (imageSize / 2)
              const imageY = cellCenterY - (imageSize / 2)
              
              doc.setFillColor(255, 255, 255)
              doc.setDrawColor(240, 240, 240)
              doc.setLineWidth(0.1)
              if (typeof (doc as any).roundedRect === 'function') {
                (doc as any).roundedRect(
                  data.cell.x + imagePadding, 
                  data.cell.y + imagePadding, 
                  imageSize, 
                  imageSize, 
                  1, 
                  1, 
                  'FD'
                )
              } else {
                doc.rect(data.cell.x + imagePadding, data.cell.y + imagePadding, imageSize, imageSize, 'FD')
              }
              
              doc.addImage(imgData, 'PNG', imageX, imageY, imageSize, imageSize, undefined, 'FAST')
            } catch (error) {
              console.warn(`Could not add image for product ${product.id}:`, error)
            }
          } else {
            doc.setFillColor(245, 245, 245)
            doc.setDrawColor(220, 220, 220)
            doc.setLineWidth(0.1)
            const cellCenterX = data.cell.x + (data.cell.width / 2)
            const cellCenterY = data.cell.y + (data.cell.height / 2)
            const imageX = cellCenterX - (imageSize / 2)
            const imageY = cellCenterY - (imageSize / 2)
            if (typeof (doc as any).roundedRect === 'function') {
              (doc as any).roundedRect(imageX, imageY, imageSize, imageSize, 1, 1, 'FD')
            } else {
              doc.rect(imageX, imageY, imageSize, imageSize, 'FD')
            }
          }
        } else {
          doc.setFillColor(245, 245, 245)
          doc.setDrawColor(220, 220, 220)
          doc.setLineWidth(0.1)
          const cellCenterX = data.cell.x + (data.cell.width / 2)
          const cellCenterY = data.cell.y + (data.cell.height / 2)
          const imageX = cellCenterX - (imageSize / 2)
          const imageY = cellCenterY - (imageSize / 2)
          if (typeof (doc as any).roundedRect === 'function') {
            (doc as any).roundedRect(imageX, imageY, imageSize, imageSize, 1, 1, 'FD')
          } else {
            doc.rect(imageX, imageY, imageSize, imageSize, 'FD')
          }
        }
      }
    },
    didParseCell: (data: any) => {
      if (hasImageColumn && data.column.index === imageColumnIndex) {
        data.cell.minReadableHeight = imageSize + (imagePadding * 2)
      }
    },
    didDrawPage: (data: any) => {
      const pageNumber = doc.getCurrentPageInfo().pageNumber
      const totalPages = (doc as any).internal.getNumberOfPages()

      if (showFooter || showPageNumbers) {
        const footerY = pageHeight - margin
        doc.setFontSize(8)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(100, 100, 100)

        if (showFooter && footerText) {
          doc.text(footerText, margin, footerY)
        }

        if (showPageNumbers) {
          const pageText = `Page ${pageNumber} of ${totalPages}`
          doc.text(pageText, pageWidth - margin, footerY, { align: 'right' })
        }

        doc.setTextColor(0, 0, 0)
      }
    },
  })

  doc.save(`products-${new Date().getTime()}.pdf`)
}

async function generateXLSX(products: Product[], selectedColumns: string[], t: any) {
  const XLSX = await import('xlsx')

  const headers = ALL_COLUMNS
    .filter(col => selectedColumns.includes(col.id))
    .map(col => t(`columns.${col.id}`))

  const rows = products.map(product => {
    const row: Record<string, any> = {}
    if (selectedColumns.includes('image')) row[t('columns.image')] = ''
    if (selectedColumns.includes('id')) row[t('columns.id')] = product.id.slice(0, 8)
    if (selectedColumns.includes('name')) row[t('columns.name')] = product.name
    if (selectedColumns.includes('sku')) row[t('columns.sku')] = product.sku
    if (selectedColumns.includes('category')) row[t('columns.category')] = product.category?.name || 'No Category'
    if (selectedColumns.includes('mufradPrice')) {
      const price = typeof product.mufradPrice === 'number' ? product.mufradPrice : parseFloat(product.mufradPrice)
      row[t('columns.mufradPrice')] = price
    }
    if (selectedColumns.includes('jumlaPrice')) {
      const price = typeof product.jumlaPrice === 'number' ? product.jumlaPrice : parseFloat(product.jumlaPrice)
      row[t('columns.jumlaPrice')] = price
    }
    if (selectedColumns.includes('rmbPrice')) {
      const price = product.rmbPrice ? (typeof product.rmbPrice === 'number' ? product.rmbPrice : parseFloat(product.rmbPrice)) : null
      row[t('columns.rmbPrice')] = price || ''
    }
    if (selectedColumns.includes('stockQuantity')) row[t('columns.stockQuantity')] = product.stockQuantity
    if (selectedColumns.includes('lowStockThreshold')) row[t('columns.lowStockThreshold')] = product.lowStockThreshold
    return row
  })

  const worksheet = XLSX.utils.json_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Products')
  XLSX.writeFile(workbook, `products-${new Date().getTime()}.xlsx`)
}

