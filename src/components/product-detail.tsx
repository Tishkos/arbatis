"use client"

import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { getTextDirection } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { IconArrowLeft, IconPaperclip, IconCalendar, IconUser, IconEdit, IconTrash, IconFile, IconDownload, IconX } from '@tabler/icons-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { useState, useEffect, useTransition, useRef, useCallback } from 'react'
import { DeleteProductDialog } from './delete-product-dialog'
import { ProductDialog } from './product-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Spinner } from '@/components/ui/spinner'
import { IconPlus } from '@tabler/icons-react'
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
  type Updater,
} from '@tanstack/react-table'

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
  attachment: string | null // Can be a single string or JSON array string
  categoryId: string | null
  createdAt: Date | string
  updatedAt: Date | string
  category: {
    id: string
    name: string
  } | null
  createdBy: {
    id: string
    name: string | null
    email: string
  } | null
  updatedBy: {
    id: string
    name: string | null
    email: string
  } | null
}

type AttachmentItem = {
  url: string
  name: string
  type: string
}

interface ProductDetailProps {
  product: Product
  locale: string
}

type RelatedData = {
  type: 'sale' | 'invoice' | 'stock' | 'settings'
  id: string
  date: string
  quantity: number
  price: number
  total: number
  reference?: string
  notes?: string
  invoiceId?: string | null
  invoiceNumber?: string | null
  createdBy?: {
    id: string
    name: string | null
    email: string
  } | null
}

export function ProductDetail({ product, locale }: ProductDetailProps) {
  const router = useRouter()
  const t = useTranslations('products')
  const fontClass = locale === 'ku' ? 'font-kurdish' : 'font-engar'
  const direction = getTextDirection(locale as 'ku' | 'en' | 'ar')
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [relatedData, setRelatedData] = useState<RelatedData[]>([])
  const [loadingRelated, setLoadingRelated] = useState(true)
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({})
  const [isPending, startTransition] = useTransition()
  const [imageRefreshKey, setImageRefreshKey] = useState(0)
  const [isUploadingAttachments, setIsUploadingAttachments] = useState(false)
  const attachmentInputRef = useRef<HTMLInputElement>(null)

  // Fetch categories for edit dialog
  const fetchCategories = useCallback(async () => {
    try {
      const response = await fetch('/api/categories')
      const data = await response.json()
      if (data.categories) {
        setCategories(data.categories)
      }
    } catch (error) {
      console.error('Error fetching categories:', error)
    }
  }, [])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  // Fetch activities
  useEffect(() => {
    setLoadingRelated(true)
    fetch(`/api/activities?entityType=PRODUCT&entityId=${product.id}&pageSize=100`)
      .then(res => res.json())
      .then(data => {
        if (data.activities) {
          const formattedData: RelatedData[] = data.activities.map((activity: any) => {
            // Parse changes if available
            let description = activity.description
            const changes = activity.changes as any
            
            if (changes && typeof changes === 'object') {
              const changeDetails: string[] = []
              Object.keys(changes).forEach(key => {
                const change = changes[key]
                if (change.old !== change.new) {
                  const labelMap: { [key: string]: string } = {
                    name: t('columns.name'),
                    sku: locale === "ku" ? "کۆد" : locale === "ar" ? "الكود" : t('columns.sku'),
                    mufradPrice: t('columns.retailPrice'),
                    jumlaPrice: t('columns.wholesalePrice'),
                    stockQuantity: t('columns.quantity'),
                    categoryId: t('columns.category'),
                  }
                  const label = labelMap[key] || key
                  changeDetails.push(`${label}: ${change.old} → ${change.new}`)
                }
              })
              if (changeDetails.length > 0) {
                description += ` (${changeDetails.join(', ')})`
              }
            }
            
            // Determine activity type for display
            let displayType: 'sale' | 'stock' | 'invoice' | 'settings' = 'settings'
            if (activity.type === 'CREATED') {
              displayType = 'sale'
            } else if (activity.type === 'STOCK_ADDED' || activity.type === 'STOCK_REDUCED' || activity.type === 'STOCK_ADJUSTED') {
              displayType = 'stock'
            } else if (activity.type === 'INVOICED' || activity.invoiceId || activity.invoiceNumber) {
              displayType = 'invoice'
            } else if (
              activity.type === 'ATTACHMENT_ADDED' || 
              activity.type === 'ATTACHMENT_REMOVED' || 
              activity.type === 'IMAGE_CHANGED' || 
              activity.type === 'UPDATED' ||
              activity.type === 'PRICE_CHANGED' ||
              activity.type === 'CATEGORY_CHANGED'
            ) {
              displayType = 'settings'
            }
            
            return {
              type: displayType,
              id: activity.id,
              date: activity.createdAt,
              quantity: changes?.stockQuantity?.new || changes?.stockQuantity?.old || 0,
              price: changes?.mufradPrice?.new || changes?.jumlaPrice?.new || 0,
              total: changes?.stockQuantity?.new || 0,
              reference: activity.invoiceNumber || activity.type,
              notes: description,
              invoiceId: activity.invoiceId,
              invoiceNumber: activity.invoiceNumber,
              createdBy: activity.createdBy,
            }
          })
          setRelatedData(formattedData)
        }
      })
      .catch(err => {
        console.error('Error fetching activities:', err)
        setRelatedData([])
      })
      .finally(() => setLoadingRelated(false))
  }, [product.id])

  const isLowStock = product.stockQuantity <= product.lowStockThreshold
  const initials = product.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const getStatusBadge = (stockQuantity: number) => {
    // Determine status based on stock quantity
    const isAvailable = stockQuantity > 0
    
    const statusText = isAvailable 
      ? (locale === 'ku' ? 'بەردەستە' : locale === 'ar' ? 'متاح' : 'Available')
      : (locale === 'ku' ? 'بەردەست نییە' : locale === 'ar' ? 'غير متاح' : 'Not Available')
    
    const statusColor = isAvailable
      ? 'bg-green-100 text-green-800'
      : 'bg-red-100 text-red-800'
    
    return (
      <Badge className={cn(statusColor, fontClass)}>
        {statusText}
      </Badge>
    )
  }

  const handleDeleteSuccess = () => {
    router.push(`/${locale}/products`)
  }

  const handleEditSuccess = () => {
    setIsEditDialogOpen(false)
    // Update image refresh key to force image reload
    setImageRefreshKey(prev => prev + 1)
    // Refresh the page to ensure updated data (especially images) are loaded
    // Use startTransition to refresh without blocking UI
    startTransition(() => {
      router.refresh()
    })
  }

  // Parse attachments (can be single string or JSON array)
  const parseAttachments = (): AttachmentItem[] => {
    if (!product.attachment) return []
    
    try {
      // Try to parse as JSON array
      const parsed = JSON.parse(product.attachment)
      if (Array.isArray(parsed)) {
        return parsed.map((item: string | AttachmentItem) => {
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
      const fileName = product.attachment.split('/').pop() || 'attachment'
      const extension = fileName.split('.').pop()?.toLowerCase() || ''
      return [{
        url: product.attachment,
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

  const handleAttachmentClick = () => {
    attachmentInputRef.current?.click()
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

      // Create FormData with existing product data and new attachments
      const formData = new FormData()
      formData.append('name', product.name)
      formData.append('sku', product.sku)
      formData.append('mufradPrice', String(product.mufradPrice))
      formData.append('jumlaPrice', String(product.jumlaPrice))
      if (product.rmbPrice) {
        formData.append('rmbPrice', String(product.rmbPrice))
      }
      formData.append('stockQuantity', String(product.stockQuantity))
      formData.append('lowStockThreshold', String(product.lowStockThreshold))
      if (product.categoryId) {
        formData.append('categoryId', product.categoryId)
      }
      if (product.notes) {
        formData.append('notes', product.notes)
      }

      // Append new attachments
      validFiles.forEach((file) => {
        formData.append('attachments', file)
      })

      // Append existing attachments to keep
      if (attachments.length > 0) {
        formData.append('existingAttachments', JSON.stringify(attachments.map(a => a.url)))
      }

      const response = await fetch(`/api/products/${product.id}`, {
        method: 'PUT',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload attachments')
      }

      // Refresh the page to show new attachments
      router.refresh()
    } catch (err) {
      console.error('Error uploading attachments:', err)
      alert(err instanceof Error ? err.message : 'Failed to upload attachments')
    } finally {
      setIsUploadingAttachments(false)
      if (attachmentInputRef.current) {
        attachmentInputRef.current.value = ''
      }
    }
  }

  return (
    <div className={cn("flex flex-col gap-6 px-4 md:px-6 lg:px-8 pb-8", fontClass)} style={{ direction } as React.CSSProperties}>
      {/* Header with Back Button and Actions */}
      <div className="flex items-center justify-between pt-4">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.push(`/${locale}/products`)}
            className={fontClass}
          >
            <IconArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className={cn("text-3xl font-bold", fontClass)}>{product.name}</h1>
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

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className={cn("inline-flex w-auto h-auto", fontClass)}>
          <TabsTrigger value="overview" className={cn("px-4 py-2", fontClass)}>{t('detail.overview')}</TabsTrigger>
          <TabsTrigger value="activities" className={cn("px-4 py-2", fontClass)}>{t('detail.activities')}</TabsTrigger>
          <TabsTrigger value="attachments" className={cn("px-4 py-2", fontClass)}>{t('detail.attachments')}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Image */}
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle className={fontClass}>{t('detail.productImage')}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center gap-4">
                  <Avatar className="h-48 w-48">
                    <AvatarImage 
                      key={`${product.image || 'no-image'}-${imageRefreshKey}`} 
                      src={product.image ? `${product.image}?v=${imageRefreshKey}` : undefined} 
                      alt={product.name} 
                    />
                    <AvatarFallback className="text-4xl">{initials}</AvatarFallback>
                  </Avatar>
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
                      <label className={cn("text-sm font-medium text-muted-foreground", fontClass)}>{locale === "ku" ? "کۆد" : locale === "ar" ? "الكود" : t('detail.sku')}</label>
                      <p className={cn("mt-1 text-sm font-mono", fontClass)}>{product.sku}</p>
                    </div>
                    <div>
                      <label className={cn("text-sm font-medium text-muted-foreground", fontClass)}>{t('detail.status')}</label>
                      <div className="mt-1">
                        {getStatusBadge(product.stockQuantity)}
                      </div>
                    </div>
                    <div>
                      <label className={cn("text-sm font-medium text-muted-foreground", fontClass)}>{locale === "ku" ? "ناو" : locale === "ar" ? "الاسم" : "Name"}</label>
                      <p className={cn("mt-1 text-sm", fontClass)}>{product.name}</p>
                    </div>
                    <div>
                      <label className={cn("text-sm font-medium text-muted-foreground", fontClass)}>{t("columns.category")}</label>
                      <div className="mt-1">
                        {product.category ? (
                          <Badge variant="outline" className={fontClass}>{product.category.name}</Badge>
                        ) : (
                          <span className={cn("text-sm text-muted-foreground", fontClass)}>-</span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Pricing */}
              <Card>
                <CardHeader>
                  <CardTitle className={fontClass}>{t('detail.pricing')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className={cn("text-sm font-medium text-muted-foreground", fontClass)}>{t('detail.retailPrice')}</label>
                      <p className={cn("mt-1 text-lg font-semibold", fontClass)}>
                        {(() => {
                          const price = typeof product.mufradPrice === 'number' 
                            ? product.mufradPrice 
                            : parseFloat(product.mufradPrice)
                          return price.toLocaleString('en-US', { 
                            minimumFractionDigits: 2, 
                            maximumFractionDigits: 2 
                          })
                        })()} د.ع
                      </p>
                    </div>
                    <div>
                      <label className={cn("text-sm font-medium text-muted-foreground", fontClass)}>{t('detail.wholesalePrice')}</label>
                      <p className={cn("mt-1 text-lg font-semibold", fontClass)}>
                        {(() => {
                          const price = typeof product.jumlaPrice === 'number'
                            ? product.jumlaPrice
                            : parseFloat(product.jumlaPrice)
                          return price.toLocaleString('en-US', { 
                            minimumFractionDigits: 2, 
                            maximumFractionDigits: 2 
                          })
                        })()} د.ع
                      </p>
                    </div>
                    {product.rmbPrice && (
                      <div>
                        <label className={cn("text-sm font-medium text-muted-foreground", fontClass)}>{t('detail.rmbPrice')}</label>
                        <p className={cn("mt-1 text-lg font-semibold", fontClass)}>
                          ¥{(() => {
                            const price = typeof product.rmbPrice === 'number'
                              ? product.rmbPrice
                              : parseFloat(product.rmbPrice)
                            return price.toLocaleString('en-US', { 
                              minimumFractionDigits: 2, 
                              maximumFractionDigits: 2 
                            })
                          })()}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Stock Information */}
              <Card>
                <CardHeader>
                  <CardTitle className={fontClass}>{t('detail.stockQuantity')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={cn("text-sm font-medium text-muted-foreground", fontClass)}>{t('detail.stockQuantity')}</label>
                      <div className="mt-1 flex items-center gap-2">
                        <span className={cn("text-sm font-medium", fontClass)}>
                          {product.stockQuantity}
                        </span>
                        {product.lowStockThreshold > 0 && product.stockQuantity <= product.lowStockThreshold && (
                          <Badge variant="destructive" className={fontClass}>{t('detail.lowStock')}</Badge>
                        )}
                      </div>
                    </div>
                    {product.lowStockThreshold > 0 && (
                      <div>
                        <label className={cn("text-sm font-medium text-muted-foreground", fontClass)}>{t('detail.lowStockThreshold')}</label>
                        <p className={cn("mt-1 text-sm", fontClass)}>{product.lowStockThreshold}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Notes */}
              {product.notes && (
                <Card>
                  <CardHeader>
                    <CardTitle className={fontClass}>{t('detail.notes')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className={cn("text-sm whitespace-pre-wrap", fontClass)}>{product.notes}</p>
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
                          {format(new Date(product.createdAt), 'PPpp')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <IconCalendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <label className={cn("text-sm font-medium text-muted-foreground", fontClass)}>{t('detail.lastUpdated')}</label>
                        <p className={cn("text-sm", fontClass)}>
                          {format(new Date(product.updatedAt), 'PPpp')}
                        </p>
                      </div>
                    </div>
                    {product.createdBy && (
                      <div className="flex items-center gap-2">
                        <IconUser className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <label className={cn("text-sm font-medium text-muted-foreground", fontClass)}>{t('detail.createdBy')}</label>
                          <p className={cn("text-sm", fontClass)}>
                            {product.createdBy.name || product.createdBy.email}
                          </p>
                        </div>
                      </div>
                    )}
                    {product.updatedBy && (
                      <div className="flex items-center gap-2">
                        <IconUser className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <label className={cn("text-sm font-medium text-muted-foreground", fontClass)}>{t('detail.updatedBy')}</label>
                          <p className={cn("text-sm", fontClass)}>
                            {product.updatedBy.name || product.updatedBy.email}
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

        <TabsContent value="activities" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className={fontClass}>{t('detail.activitiesChanges')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ProductActivityTable
                data={relatedData}
                loading={loadingRelated}
                fontClass={fontClass}
                columnSizing={columnSizing}
                setColumnSizing={setColumnSizing}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attachments" className="mt-6">
          <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                <CardTitle className={fontClass}>{t('detail.attachments')}</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAttachmentClick}
                  disabled={isUploadingAttachments}
                  className={cn(fontClass)}
                >
                  {isUploadingAttachments ? (
                    <>
                      <Spinner className="mr-2 h-4 w-4" />
                      {t('detail.uploading')}
                    </>
                  ) : (
                    <>
                      <IconPlus className="mr-2 h-4 w-4" />
                      {t('detail.addAttachment')}
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <input
                ref={attachmentInputRef}
                type="file"
                multiple
                onChange={handleAttachmentChange}
                className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.webp,.svg"
              />
              {attachments.length === 0 ? (
                <div className={cn("text-center py-12 text-muted-foreground", fontClass)}>
                  <IconPaperclip className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="mb-4">{t('detail.noAttachments')}</p>
                  <Button
                    variant="outline"
                    onClick={handleAttachmentClick}
                    disabled={isUploadingAttachments}
                    className={cn(fontClass)}
                  >
                    <IconPlus className="mr-2 h-4 w-4" />
                    {t('detail.addFirstAttachment')}
                  </Button>
                </div>
              ) : (
                <>
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
                            <div className="flex items-center gap-2 mt-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs"
                                onClick={() => window.open(attachment.url, '_blank')}
                              >
                                <IconDownload className="h-3 w-3 mr-1" />
                                {t('detail.view')}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
              <p className={cn("text-xs text-muted-foreground mt-4", fontClass)}>
                {t('dialog.attachmentHint')}
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <ProductDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSuccess={handleEditSuccess}
        categories={categories}
        product={product}
        onCategoriesChange={fetchCategories}
      />

      {/* Delete Dialog */}
      <DeleteProductDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onSuccess={handleDeleteSuccess}
        productName={product.name}
        productId={product.id}
      />
    </div>
  )
}

// Advanced flexible table component for product activity
function ProductActivityTable({ 
  data, 
  loading,
  fontClass,
  columnSizing,
  setColumnSizing
}: { 
  data: RelatedData[]
  loading: boolean
  fontClass: string
  columnSizing: ColumnSizingState
  setColumnSizing: (sizing: ColumnSizingState) => void
}) {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string
  const t = useTranslations('products')

  const columns: ColumnDef<RelatedData>[] = [
    {
      accessorKey: 'type',
      header: t('detail.type'),
      size: 100,
      minSize: 80,
      maxSize: 150,
      cell: ({ row }) => {
        const type = row.original.type
        const colors = {
          sale: 'bg-blue-100 text-blue-800',
          invoice: 'bg-green-100 text-green-800',
          stock: 'bg-orange-100 text-orange-800',
          settings: 'bg-purple-100 text-purple-800'
        }
        const labels = {
          sale: t('detail.sale'),
          invoice: t('detail.invoice'),
          stock: t('detail.stock'),
          settings: t('detail.settings')
        }
        return (
          <Badge className={cn(colors[type] || 'bg-gray-100 text-gray-800', fontClass)}>
            {labels[type] || type.charAt(0).toUpperCase() + type.slice(1)}
          </Badge>
        )
      },
    },
    {
      accessorKey: 'date',
      header: t('detail.date'),
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
      accessorKey: 'quantity',
      header: t('detail.quantity'),
      size: 100,
      minSize: 80,
      maxSize: 150,
      cell: ({ row }) => (
        <span className={cn("text-sm font-medium", fontClass)}>
          {row.original.quantity}
        </span>
      ),
    },
    {
      accessorKey: 'price',
      header: t('detail.price'),
      size: 120,
      minSize: 100,
      maxSize: 180,
      cell: ({ row }) => {
        const price = row.original.price
        if (price === 0) return <span className={cn("text-muted-foreground", fontClass)}>-</span>
        return (
          <span className={cn("text-sm", fontClass)}>
            {price.toLocaleString()} IQD
          </span>
        )
      },
    },
    {
      accessorKey: 'total',
      header: t('detail.total'),
      size: 130,
      minSize: 110,
      maxSize: 200,
      cell: ({ row }) => {
        const total = row.original.total
        const isBalance = row.original.type === 'stock'
        return (
          <span className={cn("text-sm font-medium", fontClass)}>
            {isBalance ? total : `${total.toLocaleString()} ع.د`}
          </span>
        )
      },
    },
    {
      accessorKey: 'reference',
      header: t('detail.reference'),
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
      accessorKey: 'createdBy',
      header: t('detail.changedBy'),
      size: 150,
      minSize: 120,
      maxSize: 200,
      cell: ({ row }) => {
        const createdBy = row.original.createdBy
        return (
          <span className={cn("text-sm", fontClass)}>
            {createdBy?.name || createdBy?.email || '-'}
          </span>
        )
      },
    },
    {
      accessorKey: 'notes',
      header: t('detail.notes'),
      size: 200,
      minSize: 150,
      maxSize: 400,
      cell: ({ row }) => (
        <span className={cn("text-sm text-muted-foreground", fontClass)}>
          {row.original.notes || '-'}
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
    onColumnSizingChange: (updater: Updater<ColumnSizingState>) => {
      setColumnSizing(updater as any)
    },
    getCoreRowModel: getCoreRowModel(),
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
  })

  if (loading) {
    return <div className={cn("text-center py-8 text-muted-foreground", fontClass)}>Loading activity...</div>
  }

  if (data.length === 0) {
    return <div className={cn("text-center py-8 text-muted-foreground", fontClass)}>No related activity found</div>
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
          {table.getRowModel().rows.map((row) => {
            const invoiceId = row.original.invoiceId
            return (
              <TableRow 
                key={row.id}
                className={invoiceId ? "cursor-pointer hover:bg-muted/50" : ""}
                onClick={() => {
                  if (invoiceId) {
                    router.push(`/${locale}/invoices/${invoiceId}`)
                  }
                }}
              >
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
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

