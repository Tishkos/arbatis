"use client"

import { useState, useRef, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { getTextDirection } from '@/lib/i18n'
import { IconCamera, IconPaperclip, IconX, IconAlertTriangle, IconRefresh } from '@tabler/icons-react'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { cn, generateSkuCode } from '@/lib/utils'
import { Plus, Edit } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

type Motorcycle = {
  id: string
  brand: string
  model: string
  sku: string
  year: number | null
  engineSize: string | null
  vin: string | null
  color: string | null
  image: string | null
  attachment: string | null
  usdRetailPrice: number | string
  usdWholesalePrice: number | string
  rmbPrice: number | string | null
  stockQuantity: number
  lowStockThreshold: number
  status: "IN_STOCK" | "RESERVED" | "SOLD" | "OUT_OF_STOCK"
  notes: string | null
}

interface MotorcycleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  motorcycle?: Motorcycle | null
}

export function MotorcycleDialog({ open, onOpenChange, onSuccess, motorcycle }: MotorcycleDialogProps) {
  const isEditMode = !!motorcycle
  const params = useParams()
  const locale = (params?.locale as string) || 'ku'
  const t = useTranslations('motorcycles')
  
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [sku, setSku] = useState('')
  const [year, setYear] = useState('')
  const [engineSize, setEngineSize] = useState('')
  const [vin, setVin] = useState('')
  const [color, setColor] = useState('')
  const [usdRetailPrice, setUsdRetailPrice] = useState('')
  const [usdWholesalePrice, setUsdWholesalePrice] = useState('')
  const [rmbPrice, setRmbPrice] = useState('')
  const [quantity, setQuantity] = useState('')
  const [lowStockThreshold, setLowStockThreshold] = useState('10')
  const [lowStockAlertEnabled, setLowStockAlertEnabled] = useState(true)
  const [status, setStatus] = useState<"IN_STOCK" | "RESERVED" | "SOLD" | "OUT_OF_STOCK">("IN_STOCK")
  const [notes, setNotes] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([])
  const [existingAttachments, setExistingAttachments] = useState<Array<{ url: string; name: string; type: string }>>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const attachmentInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (motorcycle && open) {
      setBrand(motorcycle.brand || '')
      setModel(motorcycle.model || '')
      setSku(motorcycle.sku || '')
      setYear(motorcycle.year ? String(motorcycle.year) : '')
      setEngineSize(motorcycle.engineSize || '')
      setVin(motorcycle.vin || '')
      setColor(motorcycle.color || '')
      setUsdRetailPrice(String(motorcycle.usdRetailPrice || ''))
      setUsdWholesalePrice(String(motorcycle.usdWholesalePrice || ''))
      setRmbPrice(motorcycle.rmbPrice ? String(motorcycle.rmbPrice) : '')
      setQuantity(String(motorcycle.stockQuantity || '0'))
      setLowStockThreshold(String(motorcycle.lowStockThreshold || '10'))
      setLowStockAlertEnabled(motorcycle.lowStockThreshold > 0)
      setStatus(motorcycle.status || "IN_STOCK")
      setNotes(motorcycle.notes || '')
      setImagePreview(motorcycle.image || null)
      setImageFile(null)
      setAttachmentFiles([])
      setError(null)
      
      // Parse existing attachments
      if (motorcycle.attachment) {
        try {
          const parsed = JSON.parse(motorcycle.attachment)
          if (Array.isArray(parsed)) {
            setExistingAttachments(parsed.map((item: string | { url: string; name: string; type: string }) => {
              if (typeof item === 'string') {
                const fileName = item.split('/').pop() || 'attachment'
                const extension = fileName.split('.').pop()?.toLowerCase() || ''
                return { url: item, name: fileName, type: extension }
              }
              return item
            }))
          } else {
            const fileName = motorcycle.attachment.split('/').pop() || 'attachment'
            const extension = fileName.split('.').pop()?.toLowerCase() || ''
            setExistingAttachments([{ url: motorcycle.attachment, name: fileName, type: extension }])
          }
        } catch {
          const fileName = motorcycle.attachment.split('/').pop() || 'attachment'
          const extension = fileName.split('.').pop()?.toLowerCase() || ''
          setExistingAttachments([{ url: motorcycle.attachment, name: fileName, type: extension }])
        }
      } else {
        setExistingAttachments([])
      }
    } else if (!motorcycle && open) {
      setBrand('')
      setModel('')
      setSku(generateSkuCode()) // Auto-generate SKU for new motorcycles
      setYear('')
      setEngineSize('')
      setVin('')
      setColor('')
      setUsdRetailPrice('')
      setUsdWholesalePrice('')
      setRmbPrice('')
      setStatus("IN_STOCK")
      setNotes('')
      setImageFile(null)
      setImagePreview(null)
      setAttachmentFiles([])
      setExistingAttachments([])
      setError(null)
    }
  }, [motorcycle, open])
  
  const fontClass = locale === 'ku' ? 'font-kurdish' : 'font-engar'
  const direction = getTextDirection(locale as 'ku' | 'en' | 'ar')

  const initials = brand && model
    ? `${brand[0]}${model[0]}`.toUpperCase()
    : 'MC'

  const handleImageClick = () => {
    fileInputRef.current?.click()
  }

  const handleAttachmentClick = () => {
    attachmentInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg']
      if (!allowedTypes.includes(file.type)) {
        setError(t('dialog.errors.imageType'))
        return
      }
      
      if (file.size > 5 * 1024 * 1024) {
        setError(t('dialog.errors.imageSize'))
        return
      }

      setImageFile(file)
      setError(null)
      
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) {
      const validFiles: File[] = []
      for (const file of files) {
        if (file.size > 10 * 1024 * 1024) {
          setError(t('dialog.errors.fileSize', { name: file.name }))
          continue
        }
        validFiles.push(file)
      }
      
      if (validFiles.length > 0) {
        setAttachmentFiles(prev => [...prev, ...validFiles])
        setError(null)
      }
      
      if (attachmentInputRef.current) {
        attachmentInputRef.current.value = ''
      }
    }
  }

  const removeAttachment = (index: number) => {
    setAttachmentFiles(prev => prev.filter((_, i) => i !== index))
  }

  const removeExistingAttachment = (index: number) => {
    setExistingAttachments(prev => prev.filter((_, i) => i !== index))
  }

  const handleSave = async (e?: React.MouseEvent) => {
    e?.preventDefault()
    e?.stopPropagation()
    
    setIsLoading(true)
    setError(null)

    try {
      if (!brand.trim()) {
        setError('Brand is required')
        setIsLoading(false)
        return
      }
      if (!model.trim()) {
        setError('Model is required')
        setIsLoading(false)
        return
      }
      if (!sku.trim()) {
        setError('SKU is required')
        setIsLoading(false)
        return
      }
      if (!usdRetailPrice || parseFloat(usdRetailPrice) <= 0) {
        setError('USD Retail price must be greater than 0')
        setIsLoading(false)
        return
      }
      if (!usdWholesalePrice || parseFloat(usdWholesalePrice) <= 0) {
        setError('USD Wholesale price must be greater than 0')
        setIsLoading(false)
        return
      }

      const formData = new FormData()
      formData.append('brand', brand.trim())
      formData.append('model', model.trim())
      formData.append('sku', sku.trim())
      if (year) formData.append('year', year)
      if (engineSize) formData.append('engineSize', engineSize.trim())
      if (vin) formData.append('vin', vin.trim())
      if (color) formData.append('color', color.trim())
      formData.append('usdRetailPrice', usdRetailPrice)
      formData.append('usdWholesalePrice', usdWholesalePrice)
      if (rmbPrice) formData.append('rmbPrice', rmbPrice)
      formData.append('stockQuantity', quantity || '0')
      formData.append('lowStockThreshold', lowStockAlertEnabled ? lowStockThreshold || '10' : '0')
      formData.append('status', status)
      if (notes) formData.append('notes', notes.trim())
      
      if (imageFile) {
        formData.append('image', imageFile)
      }
      
      // Append multiple attachments
      attachmentFiles.forEach((file) => {
        formData.append('attachments', file)
      })
      
      // Append existing attachments to keep (as JSON)
      if (existingAttachments.length > 0) {
        formData.append('existingAttachments', JSON.stringify(existingAttachments.map(a => a.url)))
      }

      const url = isEditMode ? `/api/motorcycles/${motorcycle.id}` : '/api/motorcycles'
      const method = isEditMode ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        const errorMsg = data.error || (isEditMode ? t('dialog.updateFailed') : t('dialog.creationFailed'))
        if (data.error && data.error.includes('SKU')) {
          throw new Error(t('dialog.errors.skuInUse'))
        }
        throw new Error(errorMsg)
      }

      if (!isEditMode) {
        setBrand('')
        setModel('')
        setSku('')
        setYear('')
        setEngineSize('')
        setVin('')
        setColor('')
        setUsdRetailPrice('')
        setUsdWholesalePrice('')
        setRmbPrice('')
        setQuantity('')
        setLowStockThreshold('10')
        setLowStockAlertEnabled(true)
        setStatus("IN_STOCK")
        setNotes('')
        setImageFile(null)
        setImagePreview(null)
        setAttachmentFiles([])
        setExistingAttachments([])
      }

      setIsLoading(false)
      onOpenChange(false)
      
      // Show success toast
      toast({
        title: isEditMode ? t('dialog.motorcycleUpdated') : t('dialog.motorcycleCreated'),
        description: isEditMode 
          ? t('dialog.motorcycleUpdatedSuccess', { name: `${brand.trim()} ${model.trim()}` })
          : t('dialog.motorcycleCreatedSuccess', { name: `${brand.trim()} ${model.trim()}` }),
      })
      
      if (onSuccess) {
        onSuccess()
      }
    } catch (err) {
      console.error(`Error ${isEditMode ? 'updating' : 'creating'} motorcycle:`, err)
      const errorMessage = err instanceof Error ? err.message : (isEditMode ? 'Failed to update motorcycle' : 'Failed to create motorcycle')
      setError(errorMessage)
      setIsLoading(false)
      
      // Show error toast
      toast({
        title: isEditMode ? t('dialog.updateFailed') : t('dialog.creationFailed'),
        description: errorMessage,
        variant: 'destructive',
      })
    }
  }

  const handleCancel = () => {
    onOpenChange(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent 
        className={cn("!max-w-[800px] w-[100vw] max-h-[110vh] overflow-y-auto", fontClass)} 
        style={{ direction } as React.CSSProperties}
      >
        <AlertDialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <AlertDialogTitle 
                className={cn(direction === 'rtl' && 'text-right', fontClass, "text-xl flex items-center gap-2")}
                style={{ direction } as React.CSSProperties}
              >
                {isEditMode ? (
                  <>
                    <Edit className="h-5 w-5" />
                    {t('dialog.editMotorcycle')}
                  </>
                ) : (
                  <>
                    <Plus className="h-5 w-5" />
                    {t('dialog.addMotorcycle')}
                  </>
                )}
              </AlertDialogTitle>
              <AlertDialogDescription 
                className={cn(direction === 'rtl' && 'text-right', fontClass, "mt-1")}
                style={{ direction } as React.CSSProperties}
              >
                {isEditMode ? t('dialog.updateMotorcycleInfo') : t('dialog.enterMotorcycleDetails')}
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basic" className={fontClass}>{t('dialog.basicInfo')}</TabsTrigger>
            <TabsTrigger value="pricing" className={fontClass}>{t('dialog.pricing')}</TabsTrigger>
            <TabsTrigger value="additional" className={fontClass}>{t('dialog.additional')}</TabsTrigger>
          </TabsList>

          {/* BASIC INFO TAB */}
          <TabsContent value="basic" className="space-y-4 mt-4">
            <div className="grid grid-cols-[180px_1fr] gap-6">
              {/* Image Section - Left */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  <Avatar className="h-32 w-32 border-2 border-border">
                    <AvatarImage 
                      src={imagePreview || undefined} 
                      alt={`${brand} ${model}` || 'Motorcycle'} 
                    />
                    <AvatarFallback className="text-3xl bg-muted">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <button
                    type="button"
                    onClick={handleImageClick}
                    className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all"
                  >
                    <IconCamera className="h-5 w-5" />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
                <p className={cn("text-xs text-muted-foreground text-center", fontClass)}>
                  {t('dialog.imageHint')}
                </p>
              </div>

              {/* Form Fields - Right */}
              <div className="space-y-4">
                {/* Brand & Model in same row */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="brand" className={cn(fontClass, "flex items-center gap-1")}>
                      {t('dialog.brand')} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="brand"
                      value={brand}
                      onChange={(e) => setBrand(e.target.value)}
                      placeholder={t('dialog.brandPlaceholder')}
                      className={fontClass}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="model" className={cn(fontClass, "flex items-center gap-1")}>
                      {t('dialog.model')} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="model"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      placeholder={t('dialog.modelPlaceholder')}
                      className={fontClass}
                    />
                  </div>
                </div>

                {/* SKU */}
                <div className="space-y-2">
                  <Label htmlFor="sku" className={cn(fontClass, "flex items-center gap-1")}>
                    {t('dialog.sku')} <span className="text-destructive">*</span>
                  </Label>
                  <div className="flex gap-2">
                  <Input
                    id="sku"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    placeholder={t('dialog.skuPlaceholder')}
                    className={fontClass}
                  />
                    {!isEditMode && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setSku(generateSkuCode())}
                        title="Generate new code"
                        className="flex-shrink-0"
                      >
                        <IconRefresh className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <p className={cn("text-xs text-muted-foreground", fontClass)}>
                    {t('dialog.skuHint')}
                  </p>
                </div>

                {/* Year & Engine Size */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="year" className={fontClass}>{t('dialog.year')}</Label>
                    <Input
                      id="year"
                      type="number"
                      value={year}
                      onChange={(e) => setYear(e.target.value)}
                      placeholder={t('dialog.yearPlaceholder')}
                      className={fontClass}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="engineSize" className={fontClass}>{t('dialog.engineSize')}</Label>
                    <Input
                      id="engineSize"
                      value={engineSize}
                      onChange={(e) => setEngineSize(e.target.value)}
                      placeholder={t('dialog.engineSizePlaceholder')}
                      className={fontClass}
                    />
                  </div>
                </div>

                {/* VIN & Color */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="vin" className={fontClass}>{t('dialog.vin')}</Label>
                    <Input
                      id="vin"
                      value={vin}
                      onChange={(e) => setVin(e.target.value)}
                      placeholder={t('dialog.vinPlaceholder')}
                      className={fontClass}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="color" className={fontClass}>{t('dialog.color')}</Label>
                    <Input
                      id="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      placeholder={t('dialog.colorPlaceholder')}
                      className={fontClass}
                    />
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* PRICING TAB */}
          <TabsContent value="pricing" className="space-y-4 mt-4">
            {/* Retail & Wholesale USD Prices (Both Mandatory) */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="usdRetailPrice" className={cn(fontClass, "flex items-center gap-1")}>
                  {t('dialog.usdRetailPrice')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="usdRetailPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  value={usdRetailPrice}
                  onChange={(e) => setUsdRetailPrice(e.target.value)}
                  placeholder={t('dialog.pricePlaceholder')}
                  className={fontClass}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="usdWholesalePrice" className={cn(fontClass, "flex items-center gap-1")}>
                  {t('dialog.usdWholesalePrice')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="usdWholesalePrice"
                  type="number"
                  step="0.01"
                  min="0"
                  value={usdWholesalePrice}
                  onChange={(e) => setUsdWholesalePrice(e.target.value)}
                  placeholder={t('dialog.pricePlaceholder')}
                  className={fontClass}
                />
              </div>
            </div>

            {/* RMB Price (Optional) */}
            <div className="space-y-2">
              <Label htmlFor="rmbPrice" className={fontClass}>
                {t('dialog.rmbPrice')}
              </Label>
              <Input
                id="rmbPrice"
                type="number"
                step="0.01"
                min="0"
                value={rmbPrice}
                onChange={(e) => setRmbPrice(e.target.value)}
                placeholder={t('dialog.pricePlaceholder')}
                className={fontClass}
              />
            </div>

            {/* Stock Section */}
            {/* Stock Section */}
<div className="rounded-lg border p-4 space-y-4 bg-muted/30">
  <div className="flex items-center justify-between">
    <div>
      <Label className={cn(fontClass, "text-base font-semibold")}>
        {t('dialog.stockManagement')}
      </Label>
      <p className={cn("text-sm text-muted-foreground mt-1", fontClass)}>
        {t('dialog.configureInventory')}
      </p>
    </div>
  </div>

  <div className="grid grid-cols-2 gap-4">
    <div className="space-y-2">
      <div className="flex items-center justify-between h-[1.375rem]">
        <Label htmlFor="quantity" className={fontClass}>
          {t('dialog.currentQuantity')}
        </Label>
      </div>
      <Input
        id="quantity"
        type="number"
        min="0"
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        placeholder={t('dialog.quantityPlaceholder')}
        className={fontClass}
      />
      <div className="h-5" />
    </div>

    <div className="space-y-2">
      <div className="flex items-center justify-between h-[1.375rem]">
        <Label htmlFor="lowStockThreshold" className={fontClass}>
          {t('dialog.lowStockAlert')}
        </Label>
        <Switch
          checked={lowStockAlertEnabled}
          onCheckedChange={setLowStockAlertEnabled}
        />
      </div>
      <Input
        id="lowStockThreshold"
        type="number"
        min="0"
        value={lowStockThreshold}
        onChange={(e) => setLowStockThreshold(e.target.value)}
        placeholder={t('dialog.thresholdPlaceholder')}
        disabled={!lowStockAlertEnabled}
        className={cn(fontClass, !lowStockAlertEnabled && "opacity-50")}
      />
      <div className="h-5">
        {lowStockAlertEnabled && (
          <p className={cn("text-xs text-muted-foreground", fontClass)}>
            {t('dialog.alertWhenStockFalls')}
          </p>
        )}
      </div>
    </div>
  </div>
</div>

          </TabsContent>

          {/* ADDITIONAL TAB */}
          <TabsContent value="additional" className="space-y-4 mt-4">
            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes" className={fontClass}>
                {t('dialog.notes')}
              </Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('dialog.notesPlaceholder')}
                rows={4}
                className={fontClass}
              />
            </div>

            {/* Attachments */}
            <div className="space-y-2">
              <Label htmlFor="attachment" className={fontClass}>
                {t('dialog.attachments')}
              </Label>
              
              {/* Existing Attachments */}
              {existingAttachments.length > 0 && (
                <div className="space-y-2">
                  {existingAttachments.map((attachment, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 border rounded-md bg-muted/30"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <IconPaperclip className="h-4 w-4 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className={cn("text-sm font-medium truncate", fontClass)}>
                            {attachment.name}
                          </p>
                          <p className={cn("text-xs text-muted-foreground", fontClass)}>
                            {attachment.type.toUpperCase()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(attachment.url, '_blank')}
                          className="h-8"
                        >
                          {t('detail.view')}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeExistingAttachment(index)}
                          className="h-8 w-8"
                        >
                          <IconX className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* New Attachments */}
              {attachmentFiles.length > 0 && (
                <div className="space-y-2">
                  {attachmentFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 border rounded-md bg-primary/5"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <IconPaperclip className="h-4 w-4 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className={cn("text-sm font-medium truncate", fontClass)}>
                            {file.name}
                          </p>
                          <p className={cn("text-xs text-muted-foreground", fontClass)}>
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeAttachment(index)}
                        className="h-8 w-8"
                      >
                        <IconX className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Attachment Button */}
              <Button
                type="button"
                variant="outline"
                onClick={handleAttachmentClick}
                className={cn("w-full justify-start", fontClass)}
              >
                <IconPaperclip className="mr-2 h-4 w-4" />
                {t('dialog.addAttachment')}
              </Button>
              <input
                ref={attachmentInputRef}
                type="file"
                multiple
                onChange={handleAttachmentChange}
                className="hidden"
              />
              <p className={cn("text-xs text-muted-foreground", fontClass)}>
                {t('dialog.attachmentHint')}
              </p>
            </div>
          </TabsContent>
        </Tabs>

        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive flex items-start gap-2">
            <IconAlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel
            onClick={handleCancel}
            disabled={isLoading}
            className={fontClass}
          >
            {t('dialog.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleSave}
            disabled={isLoading || !brand.trim() || !model.trim() || !sku.trim() || !usdRetailPrice || !usdWholesalePrice}
            className={cn(fontClass, "min-w-[120px]")}
          >
            {isLoading ? (
              <>
                <Spinner className="mr-2 h-4 w-4" />
                {isEditMode ? t('dialog.updating') : t('dialog.creating')}
              </>
            ) : (
              isEditMode ? t('dialog.update') : t('dialog.addMotorcycleButton')
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
