"use client"

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { getTextDirection } from '@/lib/i18n'
import { IconPrinter, IconFileTypePdf, IconFileTypeXls, IconUpload, IconX } from '@tabler/icons-react'
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
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Checkbox } from '@/components/ui/checkbox'
import { Spinner } from '@/components/ui/spinner'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { getServeUrl } from '@/lib/serve-url'
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

interface PrintProductsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentPageProducts: Product[]
  currentPageCount: number
  totalCount: number
}

export function PrintProductsDialog({
  open,
  onOpenChange,
  currentPageProducts,
  currentPageCount,
  totalCount,
}: PrintProductsDialogProps) {
  const params = useParams()
  const locale = (params?.locale as string) || 'ku'
  const t = useTranslations('products.print')
  const fontClass = locale === 'ku' ? 'font-kurdish' : 'font-engar'
  const direction = getTextDirection(locale as 'ku' | 'en' | 'ar')
  
  // Column IDs - stable array that doesn't change
  const COLUMN_IDS = [
    'image',
    'id',
    'name',
    'sku',
    'category',
    'mufradPrice',
    'jumlaPrice',
    'rmbPrice',
    'stockQuantity',
    'lowStockThreshold',
  ] as const
  
  // Get column labels from translations - memoized to prevent infinite loops
  const ALL_COLUMNS = React.useMemo(() => [
    { id: 'image', label: t('columnLabels.image') },
    { id: 'id', label: t('columnLabels.id') },
    { id: 'name', label: t('columnLabels.name') },
    { id: 'sku', label: t('columnLabels.sku') },
    { id: 'category', label: t('columnLabels.category') },
    { id: 'mufradPrice', label: t('columnLabels.retailPrice') },
    { id: 'jumlaPrice', label: t('columnLabels.wholesalePrice') },
    { id: 'rmbPrice', label: t('columnLabels.rmbPrice') },
    { id: 'stockQuantity', label: t('columnLabels.quantity') },
    { id: 'lowStockThreshold', label: t('columnLabels.lowStockThreshold') },
  ], [t])
  
  const [printScope, setPrintScope] = useState<'current' | 'all'>('current')
  const [format, setFormat] = useState<'pdf' | 'xlsx'>('pdf')
  const [paperSize, setPaperSize] = useState<'a4' | 'a5' | 'letter' | 'legal'>('a4')
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('landscape')
  const [selectedColumns, setSelectedColumns] = useState<string[]>(COLUMN_IDS.slice())
  const [isGenerating, setIsGenerating] = useState(false)
  const [pdfLanguage, setPdfLanguage] = useState<'ku' | 'en' | 'ar'>(locale as 'ku' | 'en' | 'ar')
  
  // PDF styling options
  const [imageSize, setImageSize] = useState(20) // in mm
  const [imagePadding, setImagePadding] = useState(3) // in mm
  const [fontSize, setFontSize] = useState(9) // in pt
  const [cellPadding, setCellPadding] = useState(4) // in mm
  const [headerFontSize, setHeaderFontSize] = useState(10) // in pt
  
  // Header and Footer options
  const [headerType, setHeaderType] = useState<'logo' | 'cover' | 'date' | 'none' | 'custom'>('logo')
  const [customHeaderImage, setCustomHeaderImage] = useState<string | null>(null)
  const [customDate, setCustomDate] = useState<string>('')
  const [showPageNumbers, setShowPageNumbers] = useState(true)
  const [showFooter, setShowFooter] = useState(true)
  const [footerText, setFooterText] = useState('')
  
  // Advanced styling options
  const [headerBgColor, setHeaderBgColor] = useState('#424242') // Dark gray
  const [headerTextColor, setHeaderTextColor] = useState('#FFFFFF') // White
  const [borderColor, setBorderColor] = useState('#C8C8C8') // Light gray
  const [borderWidth, setBorderWidth] = useState(0.1) // in mm
  const [rowStriping, setRowStriping] = useState(false)
  const [stripingColor, setStripingColor] = useState('#F5F5F5') // Very light gray

  useEffect(() => {
    if (open) {
      setPrintScope('current')
      setFormat('pdf')
      setPaperSize('a4')
      setOrientation('landscape')
      setSelectedColumns(COLUMN_IDS.slice())
      setImageSize(20)
      setImagePadding(3)
      setFontSize(9)
      setCellPadding(4)
      setHeaderFontSize(10)
      setHeaderType('logo')
      setCustomHeaderImage(null)
      setCustomDate('')
      setShowPageNumbers(true)
      setShowFooter(true)
      setFooterText('')
      setHeaderBgColor('#424242')
      setHeaderTextColor('#FFFFFF')
      setBorderColor('#C8C8C8')
      setBorderWidth(0.1)
      setRowStriping(false)
      setStripingColor('#F5F5F5')
      setPdfLanguage(locale as 'ku' | 'en' | 'ar')
    }
  }, [open, locale])

  // Get products for preview
  const previewProducts = React.useMemo(() => {
    return printScope === 'current' ? currentPageProducts : []
  }, [printScope, currentPageProducts])

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
      alert(t('errors.selectColumn'))
      return
    }

    setIsGenerating(true)
    try {
      let productsToPrint = currentPageProducts

      if (printScope === 'all') {
        // Fetch all products
        const response = await fetch('/api/products?pageSize=10000')
        const data = await response.json()
        productsToPrint = data.products || []
      }

      // Always use HTML printing for better font support (Kurdish/Arabic)
      await generateHTML(
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
        pdfLanguage,
        ALL_COLUMNS,
        t
      )

      onOpenChange(false)
    } catch (error) {
      console.error('Error generating print file:', error)
      alert(t('errors.generationFailed'))
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        className={cn("sm:max-w-6xl w-[95vw] max-h-[95vh] [&>div]:!flex [&>div]:!flex-col [&>div]:!max-h-[95vh] [&>div]:!p-0", fontClass)}
        style={{ direction } as React.CSSProperties}
      >
        <div className="flex flex-col max-h-[95vh] overflow-hidden">
          <AlertDialogHeader className="flex-shrink-0 px-6 pt-6 pb-4">
            <AlertDialogTitle
              className={cn(direction === 'rtl' && 'text-right', fontClass)}
              style={{ direction } as React.CSSProperties}
            >
              {t('title')}
            </AlertDialogTitle>
            <AlertDialogDescription
              className={cn(direction === 'rtl' && 'text-right', fontClass)}
              style={{ direction } as React.CSSProperties}
            >
              {t('description')}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="flex gap-6 px-6 pb-4 flex-1 min-h-0 overflow-y-auto">
            {/* Left Side - Settings */}
            <div className="flex-1 space-y-6 overflow-y-auto pr-4 min-h-0">
            {/* Print Scope */}
            <div className="space-y-3">
              <Label className={fontClass}>{t('print')}</Label>
              <RadioGroup value={printScope} onValueChange={(value: 'current' | 'all') => setPrintScope(value)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="current" id="current" />
                  <Label htmlFor="current" className={cn("font-normal cursor-pointer", fontClass)}>
                    {t('currentPage', { count: currentPageCount })}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="all" id="all" />
                  <Label htmlFor="all" className={cn("font-normal cursor-pointer", fontClass)}>
                    {t('allProducts', { count: totalCount })}
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

            {/* PDF Language Selection (only for PDF) */}
            {format === 'pdf' && (
              <div className="space-y-3">
                <Label className={fontClass}>{t('pdfLanguage')}</Label>
                <p className={cn("text-xs text-muted-foreground", fontClass)}>{t('pdfLanguageDescription')}</p>
                <Select value={pdfLanguage} onValueChange={(value: 'ku' | 'en' | 'ar') => setPdfLanguage(value)}>
                  <SelectTrigger className={cn("w-full", fontClass)}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ku">کوردی (Kurdish)</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="ar">العربية (Arabic)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

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

            {/* Header Options (only for PDF) */}
            {format === 'pdf' && (
              <div className="space-y-3 border-t pt-4">
                <Label className={cn("text-sm font-semibold", fontClass)}>{t('headerOptions')}</Label>
                <Label className={cn("text-xs", fontClass)}>{t('headerType')}</Label>
                <Select value={headerType} onValueChange={(value: 'logo' | 'cover' | 'date' | 'none' | 'custom') => setHeaderType(value)}>
                  <SelectTrigger className={cn("w-full", fontClass)}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="logo">{t('logo')}</SelectItem>
                    <SelectItem value="cover">{t('cover')}</SelectItem>
                    <SelectItem value="date">{t('date')}</SelectItem>
                    <SelectItem value="custom">{t('custom')}</SelectItem>
                    <SelectItem value="none">{t('none')}</SelectItem>
                  </SelectContent>
                </Select>

                {/* Custom Header Options */}
                {headerType === 'custom' && (
                  <div className="space-y-3 mt-3 p-3 border rounded-md bg-muted/30">
                    <Label className={cn("text-xs font-medium", fontClass)}>{t('customHeaderImage')}</Label>
                    <div className="space-y-2">
                      {customHeaderImage ? (
                        <div className="relative">
                          <img 
                            src={customHeaderImage} 
                            alt="Custom header" 
                            className="w-full h-32 object-contain border rounded bg-white"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute top-1 right-1 h-6 w-6"
                            onClick={() => setCustomHeaderImage(null)}
                          >
                            <IconX className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-muted-foreground/25 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                          <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <IconUpload className="h-8 w-8 text-muted-foreground mb-2" />
                            <p className={cn("text-xs text-muted-foreground", fontClass)}>
                              {t('clickToUpload')}
                            </p>
                          </div>
                          <input
                            type="file"
                            className="hidden"
                            accept="image/png,image/jpeg,image/jpg"
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) {
                                const reader = new FileReader()
                                reader.onloadend = () => {
                                  setCustomHeaderImage(reader.result as string)
                                }
                                reader.readAsDataURL(file)
                              }
                            }}
                          />
                        </label>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label className={cn("text-xs font-medium", fontClass)}>{t('customDate')}</Label>
                      <Input
                        type="text"
                        value={customDate}
                        onChange={(e) => setCustomDate(e.target.value)}
                        placeholder={t('enterCustomDate')}
                        className={cn("w-full h-8 text-sm", fontClass)}
                      />
                      <p className={cn("text-xs text-muted-foreground", fontClass)}>
                        {t('leaveEmpty')}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* PDF Styling Options (only for PDF) */}
            {format === 'pdf' && (
              <div className="space-y-4 border-t pt-4">
                <Label className={cn("text-sm font-semibold", fontClass)}>{t('pdfStyling')}</Label>
                
                {/* Image Size */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className={cn("text-sm", fontClass)}>{t('imageSize')}</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="10"
                        max="40"
                        value={imageSize}
                        onChange={(e) => setImageSize(Math.max(10, Math.min(40, Number(e.target.value))))}
                        className={cn("w-16 h-7 text-xs", fontClass)}
                      />
                      <span className="text-xs text-muted-foreground">{t('mm')}</span>
                    </div>
                  </div>
                  <Slider
                    value={[imageSize]}
                    onValueChange={(value: number[]) => setImageSize(value[0])}
                    min={10}
                    max={40}
                    step={1}
                    className="w-full"
                  />
                </div>

                {/* Image Padding */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className={cn("text-sm", fontClass)}>{t('imagePadding')}</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="0"
                        max="10"
                        value={imagePadding}
                        onChange={(e) => setImagePadding(Math.max(0, Math.min(10, Number(e.target.value))))}
                        className={cn("w-16 h-7 text-xs", fontClass)}
                      />
                      <span className="text-xs text-muted-foreground">{t('mm')}</span>
                    </div>
                  </div>
                  <Slider
                    value={[imagePadding]}
                    onValueChange={(value: number[]) => setImagePadding(value[0])}
                    min={0}
                    max={10}
                    step={0.5}
                    className="w-full"
                  />
                </div>

                {/* Font Size */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className={cn("text-sm", fontClass)}>{t('fontSize')}</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="6"
                        max="14"
                        value={fontSize}
                        onChange={(e) => setFontSize(Math.max(6, Math.min(14, Number(e.target.value))))}
                        className={cn("w-16 h-7 text-xs", fontClass)}
                      />
                      <span className="text-xs text-muted-foreground">{t('pt')}</span>
                    </div>
                  </div>
                  <Slider
                    value={[fontSize]}
                    onValueChange={(value: number[]) => setFontSize(value[0])}
                    min={6}
                    max={14}
                    step={0.5}
                    className="w-full"
                  />
                </div>

                {/* Header Font Size */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className={cn("text-sm", fontClass)}>{t('headerFontSize')}</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="8"
                        max="16"
                        value={headerFontSize}
                        onChange={(e) => setHeaderFontSize(Math.max(8, Math.min(16, Number(e.target.value))))}
                        className={cn("w-16 h-7 text-xs", fontClass)}
                      />
                      <span className="text-xs text-muted-foreground">{t('pt')}</span>
                    </div>
                  </div>
                  <Slider
                    value={[headerFontSize]}
                    onValueChange={(value: number[]) => setHeaderFontSize(value[0])}
                    min={8}
                    max={16}
                    step={0.5}
                    className="w-full"
                  />
                </div>

                {/* Cell Padding */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className={cn("text-sm", fontClass)}>{t('cellPadding')}</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="1"
                        max="10"
                        value={cellPadding}
                        onChange={(e) => setCellPadding(Math.max(1, Math.min(10, Number(e.target.value))))}
                        className={cn("w-16 h-7 text-xs", fontClass)}
                      />
                      <span className="text-xs text-muted-foreground">{t('mm')}</span>
                    </div>
                  </div>
                  <Slider
                    value={[cellPadding]}
                    onValueChange={(value: number[]) => setCellPadding(value[0])}
                    min={1}
                    max={10}
                    step={0.5}
                    className="w-full"
                  />
                </div>
              </div>
            )}

            {/* Footer Options (only for PDF) */}
            {format === 'pdf' && (
              <div className="space-y-3 border-t pt-4">
                <Label className={cn("text-sm font-semibold", fontClass)}>{t('footerOptions')}</Label>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="showPageNumbers"
                    checked={showPageNumbers}
                    onCheckedChange={(checked) => setShowPageNumbers(checked === true)}
                  />
                  <Label htmlFor="showPageNumbers" className={cn("font-normal cursor-pointer text-sm", fontClass)}>
                    {t('showPageNumbers')}
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="showFooter"
                    checked={showFooter}
                    onCheckedChange={(checked) => setShowFooter(checked === true)}
                  />
                  <Label htmlFor="showFooter" className={cn("font-normal cursor-pointer text-sm", fontClass)}>
                    {t('showFooter')}
                  </Label>
                </div>

                {showFooter && (
                  <div className="space-y-2">
                    <Label className={cn("text-xs", fontClass)}>{t('footerText')}</Label>
                    <Input
                      type="text"
                      value={footerText}
                      onChange={(e) => setFooterText(e.target.value)}
                      placeholder={t('enterFooterText')}
                      className={cn("w-full h-8 text-sm", fontClass)}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Advanced Styling Options (only for PDF) */}
            {format === 'pdf' && (
              <div className="space-y-3 border-t pt-4">
                <Label className={cn("text-sm font-semibold", fontClass)}>{t('advancedStyling')}</Label>
                
                {/* Header Colors */}
                <div className="space-y-2">
                  <Label className={cn("text-xs", fontClass)}>{t('headerBgColor')}</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="color"
                      value={headerBgColor}
                      onChange={(e) => setHeaderBgColor(e.target.value)}
                      className="w-16 h-8"
                    />
                    <Input
                      type="text"
                      value={headerBgColor}
                      onChange={(e) => setHeaderBgColor(e.target.value)}
                      className={cn("flex-1 h-8 text-xs font-mono", fontClass)}
                      placeholder="#424242"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className={cn("text-xs", fontClass)}>{t('headerTextColor')}</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="color"
                      value={headerTextColor}
                      onChange={(e) => setHeaderTextColor(e.target.value)}
                      className="w-16 h-8"
                    />
                    <Input
                      type="text"
                      value={headerTextColor}
                      onChange={(e) => setHeaderTextColor(e.target.value)}
                      className={cn("flex-1 h-8 text-xs font-mono", fontClass)}
                      placeholder="#FFFFFF"
                    />
                  </div>
                </div>

                {/* Border Options */}
                <div className="space-y-2">
                  <Label className={cn("text-xs", fontClass)}>{t('borderColor')}</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="color"
                      value={borderColor}
                      onChange={(e) => setBorderColor(e.target.value)}
                      className="w-16 h-8"
                    />
                    <Input
                      type="text"
                      value={borderColor}
                      onChange={(e) => setBorderColor(e.target.value)}
                      className={cn("flex-1 h-8 text-xs font-mono", fontClass)}
                      placeholder="#C8C8C8"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className={cn("text-xs", fontClass)}>{t('borderWidth')}</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="0"
                        max="2"
                        step="0.1"
                        value={borderWidth}
                        onChange={(e) => setBorderWidth(Math.max(0, Math.min(2, Number(e.target.value))))}
                        className={cn("w-16 h-7 text-xs", fontClass)}
                      />
                      <span className="text-xs text-muted-foreground">{t('mm')}</span>
                    </div>
                  </div>
                  <Slider
                    value={[borderWidth]}
                    onValueChange={(value: number[]) => setBorderWidth(value[0])}
                    min={0}
                    max={2}
                    step={0.1}
                    className="w-full"
                  />
                </div>

                {/* Row Striping */}
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="rowStriping"
                    checked={rowStriping}
                    onCheckedChange={(checked) => setRowStriping(checked === true)}
                  />
                  <Label htmlFor="rowStriping" className={cn("font-normal cursor-pointer text-sm", fontClass)}>
                    {t('rowStriping')}
                  </Label>
                </div>

                {rowStriping && (
                  <div className="space-y-2">
                    <Label className={cn("text-xs", fontClass)}>{t('stripingColor')}</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="color"
                        value={stripingColor}
                        onChange={(e) => setStripingColor(e.target.value)}
                        className="w-16 h-8"
                      />
                      <Input
                        type="text"
                        value={stripingColor}
                        onChange={(e) => setStripingColor(e.target.value)}
                        className={cn("flex-1 h-8 text-xs font-mono", fontClass)}
                        placeholder="#F5F5F5"
                      />
                    </div>
                  </div>
                )}
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
                      {column.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
            </div>

            {/* Right Side - Preview */}
            <div className="flex-1 border-l pl-6 overflow-y-auto min-h-0">
            <Label className={cn("text-sm font-semibold mb-3 block", fontClass)}>{t('preview')}</Label>
            <div className="border rounded-lg p-4 bg-white shadow-sm">
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground mb-3">
                  {printScope === 'current' ? t('showing', { count: currentPageCount }) : t('willShow', { count: totalCount })}
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
                              {col.label}
                            </th>
                          ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewProducts.slice(0, 10).map((product, idx) => (
                        <tr key={product.id || idx} className="border-b">
                          {selectedColumns.includes('image') && (
                            <td className="border" style={{ padding: `${cellPadding * 2}px`, width: `${(imageSize + imagePadding * 2) * 3.78}px` }}>
                              {product.image ? (
                                <img 
                                  src={getServeUrl(product.image) || product.image} 
                                  alt={product.name}
                                  className="object-cover rounded"
                                  style={{ 
                                    width: `${imageSize * 3.78}px`, 
                                    height: `${imageSize * 3.78}px`,
                                    display: 'block',
                                    margin: '0 auto'
                                  }}
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none'
                                    const fallback = (e.target as HTMLImageElement).nextElementSibling as HTMLElement
                                    if (fallback) fallback.style.display = 'block'
                                  }}
                                />
                              ) : null}
                              <div 
                                className="bg-muted rounded" 
                                style={{ 
                                  width: `${imageSize * 3.78}px`, 
                                  height: `${imageSize * 3.78}px`,
                                  display: product.image ? 'none' : 'block',
                                  margin: '0 auto'
                                }}
                              ></div>
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
                            {t('noProductsPreview')}
                          </td>
                        </tr>
                      )}
                      {previewProducts.length > 10 && (
                        <tr>
                          <td 
                            colSpan={selectedColumns.length} 
                            className={cn("border p-2 text-center text-xs text-muted-foreground", fontClass)}
                          >
                            {t('andMore', { count: previewProducts.length - 10 })}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
          </div>

          <AlertDialogFooter className="flex-shrink-0 border-t px-6 py-4 bg-background sticky bottom-0 z-10">
          <AlertDialogCancel
            onClick={() => onOpenChange(false)}
            disabled={isGenerating}
            className={fontClass}
          >
            {t('cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handlePrint}
            disabled={isGenerating || selectedColumns.length === 0}
            className={fontClass}
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
          </AlertDialogAction>
        </AlertDialogFooter>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  )
}

async function generateHTML(
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
  pdfLanguage: 'ku' | 'en' | 'ar' = 'ku',
  allColumns: Array<{ id: string; label: string }> = [],
  t: (key: string) => string
) {
  // Load translation messages
  const messagesMap = {
    ku: (await import('../../messages/ku.json')).default,
    en: (await import('../../messages/en.json')).default,
    ar: (await import('../../messages/ar.json')).default,
  }
  const messages = messagesMap[pdfLanguage]
  const translate = (key: string): string => {
    if (!messages) return key
    const keys = key.split('.')
    let value: any = messages
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k]
      } else {
        return key
      }
    }
    return typeof value === 'string' ? value : key
  }

  const isRTL = pdfLanguage === 'ku' || pdfLanguage === 'ar'
  const dir = isRTL ? 'rtl' : 'ltr'
  const fontClass = pdfLanguage === 'ku' ? 'font-kurdish' : 'font-engar'
  
  // Build headers using PDF language translations
  // Map column IDs to translation keys (handle mismatches)
  const getTranslationKey = (colId: string): string => {
    const keyMap: Record<string, string> = {
      'mufradPrice': 'retailPrice',
      'jumlaPrice': 'wholesalePrice',
    }
    const mappedKey = keyMap[colId] || colId
    return `products.print.columnLabels.${mappedKey}`
  }
  
  const headers = selectedColumns.map(colId => {
    // Use translate function with PDF language instead of allColumns
    const translationKey = getTranslationKey(colId)
    const translatedLabel = translate(translationKey)
    // If translation found, use it; otherwise fallback to allColumns or colId
    return translatedLabel !== translationKey ? translatedLabel : (allColumns.find(c => c.id === colId)?.label || colId)
  })

  // Convert relative image URLs to absolute URLs (use serve API for uploads so they load dynamically)
  const getAbsoluteImageUrl = (imageUrl: string | null): string => {
    if (!imageUrl) return ''
    if (imageUrl.startsWith('data:image/')) return imageUrl
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) return imageUrl
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const path = getServeUrl(imageUrl) || (imageUrl.startsWith('/') ? imageUrl : '/' + imageUrl)
    return `${origin}${path.startsWith('/') ? path : '/' + path}`
  }

  // Escape HTML to prevent XSS
  const escapeHtml = (text: string) => {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  // Build rows
  const rows = products.map(product => {
    const row: any[] = []
    if (selectedColumns.includes('image')) {
      const imageUrl = getAbsoluteImageUrl(product.image)
      row.push(imageUrl ? `<img src="${imageUrl}" alt="${escapeHtml(product.name)}" style="width: ${imageSize}mm; height: ${imageSize}mm; object-fit: cover; border-radius: 4px; display: block;" onerror="this.style.display='none';" />` : '')
    }
    if (selectedColumns.includes('id')) row.push(product.id.slice(0, 8))
    if (selectedColumns.includes('name')) row.push(product.name)
    if (selectedColumns.includes('sku')) row.push(product.sku)
    if (selectedColumns.includes('category')) {
      const noCategoryText = translate('products.print.pdfContent.noCategory')
      row.push(product.category?.name || noCategoryText)
    }
    if (selectedColumns.includes('mufradPrice')) {
      const price = typeof product.mufradPrice === 'number' ? product.mufradPrice : parseFloat(String(product.mufradPrice))
      row.push(Math.round(price).toLocaleString('en-US') + ' ع.د')
    }
    if (selectedColumns.includes('jumlaPrice')) {
      const price = typeof product.jumlaPrice === 'number' ? product.jumlaPrice : parseFloat(String(product.jumlaPrice))
      row.push(Math.round(price).toLocaleString('en-US') + ' ع.د')
    }
    if (selectedColumns.includes('rmbPrice')) {
      const price = product.rmbPrice ? (typeof product.rmbPrice === 'number' ? product.rmbPrice : parseFloat(String(product.rmbPrice))) : 0
      row.push(price ? Math.round(price).toLocaleString('en-US') + ' ع.د' : '-')
    }
    if (selectedColumns.includes('stockQuantity')) row.push(product.stockQuantity)
    if (selectedColumns.includes('lowStockThreshold')) row.push(product.lowStockThreshold)
    return row
  })

  // Generate HTML
  const html = `
<!DOCTYPE html>
<html lang="${pdfLanguage}" dir="${dir}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(translate('products.print.pdfContent.productsList'))}</title>
  <style>
    @page {
      size: A4 ${orientation};
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
      font-weight: normal;
      font-style: normal;
    }
    
    * {
      font-family: 'Kurdish', 'Arial Unicode MS', Arial, sans-serif !important;
    }
    
    body {
      font-family: 'Kurdish', 'Arial Unicode MS', Arial, sans-serif;
      font-size: ${fontSize}pt;
      direction: ${dir};
      color: #000;
      background: #fff;
    }
    
    h1, h2, h3, h4, h5, h6 {
      font-family: 'Kurdish', 'Arial Unicode MS', Arial, sans-serif;
    }
    
    th, td {
      font-family: 'Kurdish', 'Arial Unicode MS', Arial, sans-serif;
    }
    
    .header, .header h1, .header .date {
      font-family: 'Kurdish', 'Arial Unicode MS', Arial, sans-serif;
    }
    
    .footer {
      font-family: 'Kurdish', 'Arial Unicode MS', Arial, sans-serif;
    }
    
    .print-container {
      width: 100%;
      padding: 10mm;
    }
    
    .header {
      margin-bottom: 15mm;
      text-align: center;
    }
    
    .header img {
      max-height: 40mm;
      max-width: 100%;
    }
    
    .header h1 {
      font-size: ${headerFontSize + 4}pt;
      font-weight: bold;
      color: #000000;
      margin: 10mm 0;
    }
    
    .header .date {
      font-size: ${fontSize}pt;
      color: #646464;
      margin-top: 5mm;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 10mm 0;
      font-size: ${fontSize}pt;
      table-layout: auto;
    }
    
    thead {
      display: table-header-group;
    }
    
    tbody {
      display: table-row-group;
    }
    
    th {
      background-color: ${headerBgColor};
      color: ${headerTextColor};
      font-weight: bold;
      font-size: ${headerFontSize}pt;
      padding: ${cellPadding}mm;
      text-align: ${isRTL ? 'right' : 'left'};
      border: ${borderWidth}mm solid ${borderColor};
      white-space: nowrap;
    }
    
    td {
      padding: ${cellPadding}mm;
      border: ${borderWidth}mm solid ${borderColor};
      text-align: ${isRTL ? 'right' : 'left'};
      word-wrap: break-word;
      vertical-align: middle;
    }
    
    tr {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    
    tr:nth-child(even) {
      background-color: ${rowStriping ? stripingColor : 'transparent'};
    }
    
    td img {
      display: block;
      margin: 0 auto;
      max-width: 100%;
      height: auto;
    }
    
    .footer {
      margin-top: 15mm;
      text-align: center;
      font-size: ${fontSize - 1}pt;
      color: #646464;
      border-top: 1px solid ${borderColor};
      padding-top: 5mm;
    }
    
    @media print {
      body {
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }
      
      .no-print {
        display: none;
      }
      
      table {
        page-break-inside: avoid;
        break-inside: avoid;
      }
      
      thead {
        display: table-header-group;
      }
      
      tbody tr {
        page-break-inside: avoid;
        break-inside: avoid;
        page-break-after: auto;
      }
      
      tbody tr:last-child {
        page-break-after: auto;
      }
      
      /* Ensure images don't break across pages */
      td {
        page-break-inside: avoid;
        break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="print-container">
    ${headerType === 'logo' ? `
      <div class="header">
        <h1>${escapeHtml(translate('products.print.pdfContent.productsList'))}</h1>
        <div class="date">${escapeHtml(translate('products.print.pdfContent.generated'))}: ${escapeHtml(customDate || new Date().toLocaleDateString(pdfLanguage === 'ku' ? 'ku' : pdfLanguage === 'ar' ? 'ar' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' }))}</div>
      </div>
    ` : headerType === 'date' ? `
      <div class="header">
        <div class="date">${escapeHtml(translate('products.print.pdfContent.generated'))}: ${escapeHtml(customDate || new Date().toLocaleDateString(pdfLanguage === 'ku' ? 'ku' : pdfLanguage === 'ar' ? 'ar' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' }))}</div>
      </div>
    ` : headerType === 'custom' && customHeaderImage ? `
      <div class="header">
        <img src="${getAbsoluteImageUrl(customHeaderImage)}" alt="Header" />
      </div>
    ` : ''}
    
    <table>
      <thead>
        <tr>
          ${headers.map(header => `<th>${escapeHtml(header)}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${rows.map(row => `
          <tr>
            ${row.map(cell => `<td>${typeof cell === 'string' && cell.startsWith('<img') ? cell : escapeHtml(String(cell))}</td>`).join('')}
          </tr>
        `).join('')}
      </tbody>
    </table>
    
    ${showFooter || showPageNumbers ? `
      <div class="footer">
        ${showPageNumbers ? `<div>${escapeHtml(translate('products.print.pdfContent.page'))} <span class="page-number">1</span> ${escapeHtml(translate('products.print.pdfContent.of'))} <span class="total-pages">1</span></div>` : ''}
        ${showFooter && footerText ? `<div style="margin-top: 5mm;">${escapeHtml(footerText)}</div>` : ''}
      </div>
    ` : ''}
  </div>
  
  <script>
    // Auto-trigger print dialog
    window.onload = function() {
      // Update page numbers if needed
      const totalPages = Math.ceil(${rows.length} / 30); // Approximate pages
      document.querySelectorAll('.page-number').forEach(el => el.textContent = '1');
      document.querySelectorAll('.total-pages').forEach(el => el.textContent = String(totalPages));
      
      // Trigger print dialog
      setTimeout(function() {
        window.print();
      }, 250);
    };
    
    // Close window after printing (optional)
    window.onafterprint = function() {
      // window.close(); // Uncomment if you want to auto-close
    };
  </script>
</body>
</html>
  `.trim()

  // Create blob and open in new window
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const printWindow = window.open(url, '_blank')
  
  if (!printWindow) {
    throw new Error('Popup blocked. Please allow popups for this site.')
  }
  
  // Clean up URL after a delay
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

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
  pdfLanguage: 'ku' | 'en' | 'ar' = 'ku',
  allColumns: Array<{ id: string; label: string }> = []
) {
  // Load translations for PDF language - use static imports
  const [kuMessages, enMessages, arMessages] = await Promise.all([
    import('../../messages/ku.json'),
    import('../../messages/en.json'),
    import('../../messages/ar.json')
  ])
  
  const messagesMap: Record<'ku' | 'en' | 'ar', any> = {
    ku: kuMessages.default,
    en: enMessages.default,
    ar: arMessages.default
  }
  
  const messages = messagesMap[pdfLanguage]
  const t = (key: string): string => {
    if (!messages) {
      return key
    }
    const keys = key.split('.')
    let value: any = messages
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k]
      } else {
        // Key not found - return the key itself
        return key
      }
    }
    // Return the value if it's a string, otherwise return the key
    return typeof value === 'string' ? value : key
  }
  
  // Load Kurdish font BEFORE creating jsPDF instance (if needed)
  // The font file registers itself via jsPDF.API.events
  if (pdfLanguage === 'ku') {
    try {
      await import('../../public/assets/fonts/ku-font.js')
    } catch (error) {
      console.warn('Could not load Kurdish font:', error)
    }
  }
  
  const { jsPDF } = await import('jspdf')
  const autoTable = (await import('jspdf-autotable')).default
  const { containsRTLText, renderTextToImage, getFontFamily, loadKurdishFont, getPDFFont } = await import('@/lib/pdf-fonts')

  // Convert paper size to jsPDF format
  const paperSizeMap: Record<string, string> = {
    'a4': 'a4',
    'a5': 'a5',
    'letter': 'letter',
    'legal': 'legal'
  }
  
  const orientationChar = orientation === 'landscape' ? 'l' : 'p'
  const pdfPaperSize = paperSizeMap[paperSize] || 'a4'
  const doc = new jsPDF(orientationChar, 'mm', pdfPaperSize as any)
  
  // Try to load custom Kurdish font if needed
  let customKurdishFontAvailable = false
  if (pdfLanguage === 'ku') {
    customKurdishFontAvailable = await loadKurdishFont(doc)
    // If font is available, try to use it directly
    if (customKurdishFontAvailable) {
      try {
        doc.setFont('ku', 'normal')
      } catch (e) {
        // Font might not be ready yet, will use canvas rendering
        customKurdishFontAvailable = false
      }
    }
  }
  
  // Set font based on PDF language
  // For Kurdish/Arabic, we'll use canvas rendering for proper font support
  // But if custom font is available, we can use it directly for non-RTL text
  const pdfFont = getPDFFont(pdfLanguage, customKurdishFontAvailable)
  const pdfFontStyle = 'normal'
  
  // Set text direction for RTL languages
  const isRTL = pdfLanguage === 'ku' || pdfLanguage === 'ar'
  const fontFamily = getFontFamily(pdfLanguage)
  
  // Helper to render text (as image for RTL, as text for LTR)
  const renderText = async (text: string, x: number, y: number, options: {
    fontSize?: number
    fontWeight?: string
    color?: string
    align?: 'left' | 'center' | 'right'
    maxWidth?: number
  } = {}) => {
    const textSize = options.fontSize || fontSize
    const textWeight = options.fontWeight || 'normal'
    const textColor = options.color || '#000000'
    const align = options.align || 'left'
    
    if (isRTL && containsRTLText(text)) {
      // Render Kurdish/Arabic text as image
      try {
        const imageData = await renderTextToImage(
          text,
          textSize,
          fontFamily,
          textWeight,
          textColor,
          'transparent',
          'rtl'
        )
        const img = new Image()
        await new Promise((resolve, reject) => {
          img.onload = () => {
            // Calculate width in mm (assuming 96 DPI)
            const widthMM = (img.width / 96) * 25.4
            const heightMM = (img.height / 96) * 25.4
            
            // Adjust x position based on alignment
            let xPos = x
            if (align === 'center') {
              xPos = x - (widthMM / 2)
            } else if (align === 'right') {
              xPos = x - widthMM
            }
            
            doc.addImage(imageData, 'PNG', xPos, y, widthMM, heightMM)
            resolve(null)
          }
          img.onerror = reject
          img.src = imageData
        })
      } catch (error) {
        console.warn('Failed to render text as image, using fallback:', error)
        // Fallback to regular text
        doc.setFont(pdfFont, textWeight as any)
        doc.setFontSize(textSize)
        doc.setTextColor(textColor)
        doc.text(text, x, y, { align })
      }
    } else {
      // Render English text normally
      doc.setFont(pdfFont, textWeight as any)
      doc.setFontSize(textSize)
      doc.setTextColor(textColor)
      doc.text(text, x, y, { align })
    }
  }

  // Get page dimensions
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 10
  const contentWidth = pageWidth - (margin * 2)
  let startY = margin + 10

  // Helper function to convert hex to RGB
  const hexToRgb = (hex: string): [number, number, number] => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result
      ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
      : [66, 66, 66] // Default dark gray
  }

  // Header based on headerType
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
    // Cover page style header
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
    await renderText(
      t('products.print.pdfContent.productsList'),
      pageWidth / 2,
      headerHeight / 2 + 3,
      {
        fontSize: 24,
        fontWeight: 'bold',
        color: headerTextColor,
        align: 'center'
      }
    )
    doc.setTextColor(0, 0, 0)
    startY = headerHeight + 10
  } else if (headerType === 'date') {
    // Date only header
    const dateStr = new Date().toLocaleDateString(pdfLanguage === 'ku' ? 'ku' : pdfLanguage === 'ar' ? 'ar' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    await renderText(
      `${t('products.print.pdfContent.generated')}: ${dateStr}`,
      margin,
      margin + 5,
      {
        fontSize: 10,
        color: '#646464'
      }
    )
    startY = margin + 15
  } else if (headerType === 'custom') {
    // Custom header with image and date
    if (customHeaderImage) {
      try {
        // Calculate image dimensions to fit page width
        const maxImageWidth = pageWidth - (margin * 2)
        const maxImageHeight = 40
        
        // Load and add custom image using Promise
        await new Promise<void>((resolve, reject) => {
          const img = new Image()
          img.onload = () => {
            try {
              // Calculate aspect ratio
              const aspectRatio = img.width / img.height
              let imageWidth = maxImageWidth
              let imageHeight = maxImageWidth / aspectRatio
              
              // If height exceeds max, scale down
              if (imageHeight > maxImageHeight) {
                imageHeight = maxImageHeight
                imageWidth = maxImageHeight * aspectRatio
              }
              
              // Determine image format from data URL
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
      } catch (error) {
        console.warn('Could not load custom header image:', error)
        startY = margin + 10
      }
    } else {
      startY = margin + 10
    }
    
    // Add custom date or current date
    const dateText = customDate || new Date().toLocaleDateString(pdfLanguage === 'ku' ? 'ku' : pdfLanguage === 'ar' ? 'ar' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    await renderText(
      `${t('products.print.pdfContent.generated')}: ${dateText}`,
      margin,
      startY,
      {
        fontSize: 10,
        color: '#646464'
      }
    )
    doc.setTextColor(0, 0, 0)
    startY = startY + 8
  }
  // 'none' - no header, startY remains at margin + 10

  // Prepare table data with translated column labels
  const headers = allColumns
    .filter(col => selectedColumns.includes(col.id))
    .map(col => {
      // Map column IDs to translation keys
      let columnKey = col.id
      if (col.id === 'mufradPrice') columnKey = 'retailPrice'
      else if (col.id === 'jumlaPrice') columnKey = 'wholesalePrice'
      else if (col.id === 'stockQuantity') columnKey = 'quantity'
      const translated = t(`products.print.columnLabels.${columnKey}`)
      // If translation returns the key, use the label from allColumns
      return translated && translated !== `products.print.columnLabels.${columnKey}` ? translated : col.label
    })
  
  // Load all images first
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
      // Placeholder - will be replaced with image in didDrawCell
      row.push('')
    }
    if (selectedColumns.includes('id')) row.push(product.id.slice(0, 8))
    if (selectedColumns.includes('name')) row.push(product.name)
    if (selectedColumns.includes('sku')) row.push(product.sku)
    if (selectedColumns.includes('category')) {
      const noCategoryText = t('products.print.pdfContent.noCategory')
      const categoryName = product.category?.name || (noCategoryText && noCategoryText !== 'products.print.pdfContent.noCategory' ? noCategoryText : 'بێ پۆل')
      row.push(categoryName)
    }
    if (selectedColumns.includes('mufradPrice')) {
      const price = typeof product.mufradPrice === 'number' ? product.mufradPrice : parseFloat(product.mufradPrice)
      row.push(Math.round(price).toLocaleString('en-US') + ' ع.د')
    }
    if (selectedColumns.includes('jumlaPrice')) {
      const price = typeof product.jumlaPrice === 'number' ? product.jumlaPrice : parseFloat(product.jumlaPrice)
      row.push(Math.round(price).toLocaleString('en-US') + ' ع.د')
    }
    if (selectedColumns.includes('rmbPrice')) {
      const price = product.rmbPrice ? (typeof product.rmbPrice === 'number' ? product.rmbPrice : parseFloat(product.rmbPrice)) : 0
      row.push(price ? Math.round(price).toLocaleString('en-US') + ' ع.د' : '-')
    }
    if (selectedColumns.includes('stockQuantity')) row.push(product.stockQuantity)
    if (selectedColumns.includes('lowStockThreshold')) row.push(product.lowStockThreshold)
    return row
  })

  // Cache for rendered text images (text -> {imageData, width, height})
  const textImageCache = new Map<string, { imageData: string; width: number; height: number }>()
  
  // Pre-render all Kurdish text as images and load them
  if (isRTL) {
    // Pre-render and load headers
    for (const headerText of headers) {
      if (containsRTLText(headerText)) {
        try {
          const imageData = await renderTextToImage(
            headerText,
            headerFontSize,
            fontFamily,
            'bold',
            headerTextColor,
            'transparent',
            'rtl'
          )
          const img = new Image()
          await new Promise((resolve, reject) => {
            img.onload = () => {
              const widthMM = (img.width / 96) * 25.4
              const heightMM = (img.height / 96) * 25.4
              textImageCache.set(`header|${headerText}`, { imageData, width: widthMM, height: heightMM })
              resolve(null)
            }
            img.onerror = reject
            img.src = imageData
          })
        } catch (error) {
          console.warn('Failed to pre-render header text:', error)
        }
      }
    }
    
    // Pre-render and load body cell text
    for (const row of rows) {
      for (const cellValue of row) {
        const cellText = String(cellValue)
        if (containsRTLText(cellText)) {
          try {
            const imageData = await renderTextToImage(
              cellText,
              fontSize,
              fontFamily,
              'normal',
              '#000000',
              'transparent',
              'rtl'
            )
            const img = new Image()
            await new Promise((resolve, reject) => {
              img.onload = () => {
                const widthMM = (img.width / 96) * 25.4
                const heightMM = (img.height / 96) * 25.4
                textImageCache.set(`body|${cellText}`, { imageData, width: widthMM, height: heightMM })
                resolve(null)
              }
              img.onerror = reject
              img.src = imageData
            })
          } catch (error) {
            // Silently fail for body cells
          }
        }
      }
    }
  }
  
  // Helper to get text image from cache
  const getTextImage = (text: string, section: 'head' | 'body'): { imageData: string; width: number; height: number } | null => {
    if (!isRTL || !containsRTLText(text)) return null
    return textImageCache.get(`${section}|${text}`) || null
  }

  // Find image column index
  const imageColumnIndex = selectedColumns.indexOf('image')
  const hasImageColumn = imageColumnIndex !== -1

  // Use provided image size and padding

  // Convert colors to RGB
  const [headerR, headerG, headerB] = hexToRgb(headerBgColor)
  const [textR, textG, textB] = hexToRgb(headerTextColor)
  const [borderR, borderG, borderB] = hexToRgb(borderColor)
  const [stripR, stripG, stripB] = hexToRgb(stripingColor)

  // Adjust table width for portrait orientation
  const tableWidth = orientation === 'portrait' ? pageWidth - (margin * 2) : 'wrap'
  const bottomMargin = (showFooter || showPageNumbers) ? margin + 10 : margin

  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: startY,
    styles: { 
      fontSize: fontSize,
      font: pdfFont,
      fontStyle: pdfFontStyle,
      cellPadding: { top: cellPadding, bottom: cellPadding, left: cellPadding * 0.75, right: cellPadding * 0.75 },
      lineColor: [borderR, borderG, borderB],
      lineWidth: borderWidth,
      overflow: 'linebreak',
      cellWidth: orientation === 'portrait' ? 'wrap' : 'auto'
    },
    headStyles: { 
      fillColor: [headerR, headerG, headerB],
      textColor: [textR, textG, textB],
      font: pdfFont,
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
    willDrawCell: (data: any) => {
      // Prevent text from being drawn for RTL cells - we'll draw images instead
      if (isRTL && (data.section === 'head' || data.section === 'body')) {
        const cellText = String(data.cell.text || '').trim()
        if (cellText && containsRTLText(cellText)) {
          const textImage = getTextImage(cellText, data.section)
          if (textImage) {
            // Store original text for didDrawCell
            data.cell._originalText = cellText
            // Clear the text so it won't be drawn
            data.cell.text = ''
          }
        }
      }
    },
    didDrawCell: (data: any) => {
      // Render Kurdish text as images (pre-rendered and loaded)
      if (isRTL && (data.section === 'head' || data.section === 'body')) {
        // Get original text from willDrawCell or current text
        const cellText = String(data.cell._originalText || data.cell.text || '').trim()
        if (cellText && containsRTLText(cellText)) {
          const textImage = getTextImage(cellText, data.section)
          if (textImage) {
            try {
              // Draw background
              if (data.section === 'head') {
                doc.setFillColor(headerR, headerG, headerB)
              } else {
                doc.setFillColor(255, 255, 255)
                if (rowStriping && data.row.index % 2 === 1) {
                  doc.setFillColor(stripR, stripG, stripB)
                }
              }
              doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F')
              
              // Redraw border
              doc.setDrawColor(borderR, borderG, borderB)
              doc.setLineWidth(borderWidth)
              doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'S')
              
              // Add text image (already loaded with dimensions)
              // Center vertically and align based on RTL
              const x = data.cell.x + cellPadding
              const y = data.cell.y + (data.cell.height - textImage.height) / 2
              doc.addImage(textImage.imageData, 'PNG', x, y, textImage.width, textImage.height)
            } catch (error) {
              console.warn('Failed to render text image in cell:', error)
            }
          }
        }
      }
      
      // Add images to image column cells
      if (hasImageColumn && data.column.index === imageColumnIndex && data.section === 'body') {
        const rowIndex = data.row.index
        const product = products[rowIndex]
        if (product && product.image) {
          const imgData = imageMap.get(product.id)
          if (imgData) {
            try {
              // Calculate centered position for square image
              const cellCenterX = data.cell.x + (data.cell.width / 2)
              const cellCenterY = data.cell.y + (data.cell.height / 2)
              const imageX = cellCenterX - (imageSize / 2)
              const imageY = cellCenterY - (imageSize / 2)
              
              // Clear the cell content area first by drawing white rectangle with border
              doc.setFillColor(255, 255, 255)
              doc.setDrawColor(240, 240, 240)
              doc.setLineWidth(0.1)
              // Draw rounded rectangle (if available) or regular rectangle
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
              
              // Add the square image
              doc.addImage(imgData, 'PNG', imageX, imageY, imageSize, imageSize, undefined, 'FAST')
            } catch (error) {
              console.warn(`Could not add image for product ${product.id}:`, error)
            }
          } else {
            // Draw placeholder for missing image
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
          // Draw placeholder for no image
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
      // Ensure image column cells have proper height
      if (hasImageColumn && data.column.index === imageColumnIndex) {
        data.cell.minReadableHeight = imageSize + (imagePadding * 2)
      }
    },
    didDrawPage: (data: any) => {
      // Add footer and page numbers
      const pageNumber = doc.getCurrentPageInfo().pageNumber
      const totalPages = (doc as any).internal.getNumberOfPages()

      if (showFooter || showPageNumbers) {
        const footerY = pageHeight - margin
        doc.setFontSize(8)
        doc.setFont(pdfFont, pdfFontStyle)
        doc.setTextColor(100, 100, 100)

        // Footer text (left aligned)
        if (showFooter && footerText) {
          doc.text(footerText, margin, footerY)
        }

        // Page numbers (right aligned)
        if (showPageNumbers) {
          const pageLabel = t('products.print.pdfContent.page')
          const ofLabel = t('products.print.pdfContent.of')
          const pageText = `${pageLabel && pageLabel !== 'products.print.pdfContent.page' ? pageLabel : 'پەڕە'} ${pageNumber} ${ofLabel && ofLabel !== 'products.print.pdfContent.of' ? ofLabel : 'لە'} ${totalPages}`
          doc.text(pageText, pageWidth - margin, footerY, { align: 'right' })
        }

        doc.setTextColor(0, 0, 0) // Reset to black
      }
    },
  })

  doc.save(`products-${new Date().getTime()}.pdf`)
}

async function generateXLSX(products: Product[], selectedColumns: string[], allColumns: Array<{ id: string; label: string }> = []) {
  const XLSX = await import('xlsx')

  // Prepare data with column labels
  const headers = allColumns
    .filter(col => selectedColumns.includes(col.id))
    .map(col => col.label)

  const rows = products.map(product => {
    const row: Record<string, any> = {}
    if (selectedColumns.includes('image')) row['Image'] = ''
    if (selectedColumns.includes('id')) row['ID'] = product.id.slice(0, 8)
    if (selectedColumns.includes('name')) row['Name'] = product.name
    if (selectedColumns.includes('sku')) row['SKU'] = product.sku
    if (selectedColumns.includes('category')) {
      const categoryCol = allColumns.find(c => c.id === 'category')
      row[categoryCol?.label || 'Category'] = product.category?.name || ''
    }
    if (selectedColumns.includes('mufradPrice')) {
      const price = typeof product.mufradPrice === 'number' ? product.mufradPrice : parseFloat(product.mufradPrice)
      row['Retail Price (ع.د)'] = price
    }
    if (selectedColumns.includes('jumlaPrice')) {
      const price = typeof product.jumlaPrice === 'number' ? product.jumlaPrice : parseFloat(product.jumlaPrice)
      row['Wholesale Price (ع.د)'] = price
    }
    if (selectedColumns.includes('rmbPrice')) {
      const price = product.rmbPrice ? (typeof product.rmbPrice === 'number' ? product.rmbPrice : parseFloat(product.rmbPrice)) : null
      row['RMB Price (¥)'] = price || ''
    }
    if (selectedColumns.includes('stockQuantity')) row['Quantity'] = product.stockQuantity
    if (selectedColumns.includes('lowStockThreshold')) row['Low Stock Threshold'] = product.lowStockThreshold
    return row
  })

  const worksheet = XLSX.utils.json_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Products')
  XLSX.writeFile(workbook, `products-${new Date().getTime()}.xlsx`)
}

