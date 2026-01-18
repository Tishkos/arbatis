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
import { cn, generateProductSkuCode } from '@/lib/utils'
import { Plus, Edit, CheckCircle2, XCircle } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
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
  notes: string | null
  attachment: string | null
  categoryId: string | null
  category: {
    id: string
    name: string
  } | null
}

interface ProductDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  categories: { id: string; name: string }[]
  product?: Product | null
  onCategoriesChange?: () => Promise<void>
}

export function ProductDialog({ open, onOpenChange, onSuccess, categories, product, onCategoriesChange }: ProductDialogProps) {
  // Only treat as edit mode if product has a valid ID
  // Empty ID means it's a new product with pre-filled data (e.g., from sales page)
  const isEditMode = !!(product && product.id && product.id.trim() !== '')
  const params = useParams()
  const locale = (params?.locale as string) || 'ku'
  const t = useTranslations('products')
  
  const [name, setName] = useState('')
  const [sku, setSku] = useState('')
  const [categoryId, setCategoryId] = useState<string>('')
  const [newCategoryName, setNewCategoryName] = useState('')
  const [showNewCategory, setShowNewCategory] = useState(false)
  const [mufradPrice, setMufradPrice] = useState('')
  const [jumlaPrice, setJumlaPrice] = useState('')
  const [rmbPrice, setRmbPrice] = useState('')
  const [quantity, setQuantity] = useState('')
  const [lowStockThreshold, setLowStockThreshold] = useState('10')
  const [lowStockAlertEnabled, setLowStockAlertEnabled] = useState(true)
  const [notes, setNotes] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([])
  const [existingAttachments, setExistingAttachments] = useState<Array<{ url: string; name: string; type: string }>>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const attachmentInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  useEffect(() => {
    if (product && open) {
      setName(product.name || '')
      // Auto-generate SKU if empty (for new products from sales page)
      setSku(product.sku && product.sku.trim() ? product.sku : generateProductSkuCode())
      setCategoryId(product.categoryId || '')
      // Only pre-fill prices if product has a valid ID (edit mode)
      // If empty ID (new product from sales page), leave prices empty for user to enter
      if (product.id && product.id.trim() !== '') {
        setMufradPrice(String(product.mufradPrice || ''))
        setJumlaPrice(String(product.jumlaPrice || ''))
      } else {
        setMufradPrice('')
        setJumlaPrice('')
      }
      setRmbPrice(product.rmbPrice ? String(product.rmbPrice) : '')
      setQuantity(String(product.stockQuantity || '0'))
      setLowStockThreshold(String(product.lowStockThreshold || '10'))
      setLowStockAlertEnabled(product.lowStockThreshold > 0)
      setNotes(product.notes || '')
      setImagePreview(product.image || null)
      setImageFile(null)
      setAttachmentFiles([])
      setError(null)
      
      // Parse existing attachments
      if (product.attachment) {
        try {
          const parsed = JSON.parse(product.attachment)
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
            const fileName = product.attachment.split('/').pop() || 'attachment'
            const extension = fileName.split('.').pop()?.toLowerCase() || ''
            setExistingAttachments([{ url: product.attachment, name: fileName, type: extension }])
          }
        } catch {
          const fileName = product.attachment.split('/').pop() || 'attachment'
          const extension = fileName.split('.').pop()?.toLowerCase() || ''
          setExistingAttachments([{ url: product.attachment, name: fileName, type: extension }])
        }
      } else {
        setExistingAttachments([])
      }
    } else if (!product && open) {
      setName('')
      setSku(generateProductSkuCode()) // Auto-generate SKU for new products
      setCategoryId('')
      setNewCategoryName('')
      setShowNewCategory(false)
      setMufradPrice('')
      setJumlaPrice('')
      setRmbPrice('')
      setQuantity('')
      setLowStockThreshold('10')
      setLowStockAlertEnabled(true)
      setNotes('')
      setImageFile(null)
      setImagePreview(null)
      setAttachmentFiles([])
      setExistingAttachments([])
      setError(null)
    }
  }, [product, open])
  
  const fontClass = locale === 'ku' ? 'font-kurdish' : 'font-engar'
  const direction = getTextDirection(locale as 'ku' | 'en' | 'ar')

  const initials = name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'PR'

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
      if (!name.trim()) {
        setError(t('dialog.errors.nameRequired'))
        setIsLoading(false)
        return
      }
      if (!sku.trim()) {
        setError(t('dialog.errors.skuRequired'))
        setIsLoading(false)
        return
      }
      if (!mufradPrice || parseFloat(mufradPrice) <= 0) {
        setError(t('dialog.errors.retailPriceRequired'))
        setIsLoading(false)
        return
      }
      if (!jumlaPrice || parseFloat(jumlaPrice) <= 0) {
        setError(t('dialog.errors.wholesalePriceRequired'))
        setIsLoading(false)
        return
      }

      const formData = new FormData()
      formData.append('name', name.trim())
      formData.append('sku', sku.trim())
      formData.append('mufradPrice', mufradPrice)
      formData.append('jumlaPrice', jumlaPrice)
      if (rmbPrice) {
        formData.append('rmbPrice', rmbPrice)
      }
      formData.append('stockQuantity', quantity || '0')
      formData.append('lowStockThreshold', lowStockAlertEnabled ? lowStockThreshold || '10' : '0')
      if (categoryId && !showNewCategory) {
        formData.append('categoryId', categoryId)
      }
      if (showNewCategory && newCategoryName.trim()) {
        formData.append('newCategoryName', newCategoryName.trim())
      }
      if (imageFile) {
        formData.append('image', imageFile)
      }
      
      // Append multiple attachments
      attachmentFiles.forEach((file, index) => {
        formData.append(`attachments`, file)
      })
      
      // Append existing attachments to keep (as JSON)
      if (existingAttachments.length > 0) {
        formData.append('existingAttachments', JSON.stringify(existingAttachments.map(a => a.url)))
      }
      if (notes) {
        formData.append('notes', notes.trim())
      }

      const url = isEditMode ? `/api/products/${product.id}` : '/api/products'
      const method = isEditMode ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        body: formData,
      })

      // Check if response has content before parsing JSON
      const contentType = response.headers.get('content-type')
      const text = await response.text()
      let data: any = {}
      
      if (contentType && contentType.includes('application/json') && text.trim()) {
        try {
          data = JSON.parse(text)
        } catch (e) {
          console.error('Failed to parse JSON response:', e, text)
          throw new Error(isEditMode ? t('dialog.updateFailed') : t('dialog.creationFailed'))
        }
      }

      if (!response.ok) {
        const errorMsg = data.error || (isEditMode ? t('dialog.updateFailed') : t('dialog.creationFailed'))
        if (data.error && data.error.includes('SKU')) {
          throw new Error(t('dialog.errors.skuInUse'))
        }
        throw new Error(errorMsg)
      }

      if (!isEditMode) {
        setName('')
        setSku('')
        setCategoryId('')
        setNewCategoryName('')
        setShowNewCategory(false)
        setMufradPrice('')
        setJumlaPrice('')
        setRmbPrice('')
        setQuantity('')
        setLowStockThreshold('10')
        setLowStockAlertEnabled(true)
        setNotes('')
        setImageFile(null)
        setImagePreview(null)
        setAttachmentFiles([])
        setExistingAttachments([])
      }

      // If a new category was created, refetch categories
      if (showNewCategory && newCategoryName.trim() && onCategoriesChange) {
        try {
          await onCategoriesChange()
        } catch (err) {
          console.error('Error refetching categories:', err)
          // Continue even if refetch fails
        }
      }

      setIsLoading(false)
      onOpenChange(false)
      
      // Show success toast with checkmark icon
      toast({
        title: isEditMode ? t('dialog.productUpdated') : t('dialog.productCreated'),
        description: isEditMode 
          ? t('dialog.productUpdatedSuccess', { name: name.trim() })
          : t('dialog.productCreatedSuccess', { name: name.trim() }),
        action: <CheckCircle2 className="h-5 w-5 text-green-500" />,
      })
      
      if (onSuccess) {
        onSuccess()
      }
    } catch (err) {
      console.error(`Error ${isEditMode ? 'updating' : 'creating'} product:`, err)
      const errorMessage = err instanceof Error ? err.message : (isEditMode ? 'Failed to update product' : 'Failed to create product')
      setError(errorMessage)
      setIsLoading(false)
      
      // Show error toast with X icon
      toast({
        title: isEditMode ? t('dialog.updateFailed') : t('dialog.creationFailed'),
        description: errorMessage,
        variant: 'destructive',
        action: <XCircle className="h-5 w-5 text-white" />,
      })
    }
  }

  const handleCancel = () => {
    onOpenChange(false)
  }

  const isLowStock = lowStockAlertEnabled && quantity && lowStockThreshold && parseInt(quantity) <= parseInt(lowStockThreshold)

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
                    {t('dialog.editProduct')}
                  </>
                ) : (
                  <>
                    <Plus className="h-5 w-5" />
                    {t('dialog.addProduct')}
                  </>
                )}
              </AlertDialogTitle>
              <AlertDialogDescription 
                className={cn(direction === 'rtl' && 'text-right', fontClass, "mt-1")}
                style={{ direction } as React.CSSProperties}
              >
                {isEditMode ? t('dialog.updateProductInfo') : t('dialog.enterProductDetails')}
              </AlertDialogDescription>
            </div>
            {isLowStock && (
              <Badge variant="destructive" className="gap-1">
                <IconAlertTriangle className="h-3 w-3" />
                {t('lowStock')}
              </Badge>
            )}
          </div>
        </AlertDialogHeader>

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basic" className={fontClass}>{t('dialog.basicInfo')}</TabsTrigger>
            <TabsTrigger value="pricing" className={fontClass}>{t('dialog.pricingStock')}</TabsTrigger>
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
                      alt={name || 'Product'} 
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
                {/* Name & SKU in same row */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className={cn(fontClass, "flex items-center gap-1")}>
                      {t('dialog.productName')} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t('dialog.productName')}
                      className={fontClass}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sku" className={cn(fontClass, "flex items-center gap-1")}>
                      {locale === "ku" ? "کۆد" : locale === "ar" ? "الكود" : t('dialog.sku')} <span className="text-destructive">*</span>
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
                          onClick={() => setSku(generateProductSkuCode())}
                          title="Generate new code"
                          className="flex-shrink-0"
                        >
                          <IconRefresh className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Category */}
                <div className="space-y-2">
                  <Label htmlFor="category" className={fontClass}>{t('dialog.category')}</Label>
                  {!showNewCategory ? (
                    <Select
                      value={categoryId || "none"}
                      onValueChange={(value) => {
                        if (value === "new") {
                          setShowNewCategory(true)
                          setCategoryId('')
                        } else if (value !== "none") {
                          setCategoryId(value)
                        } else {
                          setCategoryId('')
                        }
                      }}
                    >
                      <SelectTrigger className={fontClass} id="category">
                        <SelectValue placeholder={t('dialog.selectCategory')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t('dialog.noCategory')}</SelectItem>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                        <SelectItem value="new">{t('dialog.createNew')}</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        placeholder={t('dialog.newCategoryName')}
                        className={cn("flex-1", fontClass)}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setShowNewCategory(false)
                          setNewCategoryName('')
                        }}
                      >
                        <IconX className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* PRICING & STOCK TAB */}
          <TabsContent value="pricing" className="space-y-4 mt-4">
            {/* Prices in one row */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="mufradPrice" className={cn(fontClass, "flex items-center gap-1")}>
                  {t('dialog.retailPrice')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="mufradPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  value={mufradPrice}
                  onChange={(e) => setMufradPrice(e.target.value)}
                  placeholder={t('dialog.pricePlaceholder')}
                  className={fontClass}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="jumlaPrice" className={cn(fontClass, "flex items-center gap-1")}>
                  {t('dialog.wholesalePrice')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="jumlaPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  value={jumlaPrice}
                  onChange={(e) => setJumlaPrice(e.target.value)}
                  placeholder={t('dialog.pricePlaceholder')}
                  className={fontClass}
                />
              </div>

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
            disabled={isLoading || !name.trim() || !sku.trim() || !mufradPrice || !jumlaPrice}
            className={cn(fontClass, "min-w-[120px]")}
          >
            {isLoading ? (
              <>
                <Spinner className="mr-2 h-4 w-4" />
                {isEditMode ? t('dialog.updating') : t('dialog.creating')}
              </>
            ) : (
              isEditMode ? t('dialog.update') : t('dialog.addProductButton')
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
