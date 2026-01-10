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
import { useState, useEffect, useRef } from 'react'
import { MotorcycleDialog } from './motorcycle-dialog'
import { DeleteMotorcycleDialog } from './delete-motorcycle-dialog'
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
  createdAt: Date | string
  updatedAt: Date | string
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

interface MotorcycleDetailProps {
  motorcycle: Motorcycle
  locale: string
}

type InvoiceData = {
  id: string
  date: string
  invoiceNumber: string
  quantity: number
  price: number
  total: number
  status: string
  notes?: string
  invoiceId?: string | null
  type?: 'sale' | 'invoice' | 'stock' | 'settings'
}

export function MotorcycleDetail({ motorcycle, locale }: MotorcycleDetailProps) {
  const router = useRouter()
  const t = useTranslations('motorcycles')
  const fontClass = locale === 'ku' ? 'font-kurdish' : 'font-engar'
  const direction = getTextDirection(locale as 'ku' | 'en' | 'ar')
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [allInvoices, setAllInvoices] = useState<InvoiceData[]>([])
  const [loadingActivities, setLoadingActivities] = useState(true)
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({})
  const [isUploadingAttachments, setIsUploadingAttachments] = useState(false)
  const attachmentInputRef = useRef<HTMLInputElement>(null)

  // Fetch activities
  useEffect(() => {
    setLoadingActivities(true)
    fetch(`/api/activities?entityType=MOTORCYCLE&entityId=${motorcycle.id}&pageSize=100`)
      .then(res => res.json())
      .then(data => {
        if (data.activities) {
          const formattedInvoices: InvoiceData[] = data.activities.map((activity: any) => {
            // Parse changes if available
            let description = activity.description
            const changes = activity.changes as any
            
            if (changes && typeof changes === 'object') {
              const changeDetails: string[] = []
              Object.keys(changes).forEach(key => {
                const change = changes[key]
                if (change.old !== change.new) {
                  const labelMap: { [key: string]: string } = {
                    brand: t('columns.brand'),
                    model: t('columns.model'),
                    sku: t('columns.sku'),
                    usdRetailPrice: t('columns.retailPrice'),
                    usdWholesalePrice: t('columns.wholesalePrice'),
                    stockQuantity: t('detail.stockQuantity'),
                  }
                  const label = labelMap[key] || key
                  changeDetails.push(`${label}: ${change.old} → ${change.new}`)
                }
              })
              if (changeDetails.length > 0) {
                description += ` (${changeDetails.join(', ')})`
              }
            }
            
            // Extract price from changes if available
            const price = changes?.usdRetailPrice?.new || changes?.usdRetailPrice?.old || 
                          changes?.usdWholesalePrice?.new || changes?.usdWholesalePrice?.old || 0
            
            // Determine activity type for display
            let displayType: 'wholesale' | 'retail' | 'settings' = 'settings'
            if (activity.type === 'CREATED') {
              displayType = 'wholesale'
            } else if (activity.type === 'STOCK_ADDED' || activity.type === 'STOCK_REDUCED' || activity.type === 'STOCK_ADJUSTED') {
              displayType = 'retail'
            } else if (activity.type === 'INVOICED' || activity.invoiceId || activity.invoiceNumber) {
              displayType = 'wholesale'
            } else if (
              activity.type === 'ATTACHMENT_ADDED' || 
              activity.type === 'ATTACHMENT_REMOVED' || 
              activity.type === 'IMAGE_CHANGED' || 
              activity.type === 'UPDATED' ||
              activity.type === 'PRICE_CHANGED'
            ) {
              displayType = 'settings'
            }
            
            return {
              id: activity.id,
              invoiceNumber: displayType === 'settings' ? t('detail.settings') : (activity.invoiceNumber || activity.type),
              customerName: `${activity.createdBy?.name || activity.createdBy?.email || 'Unknown'} - ${description}`,
              date: activity.createdAt,
              quantity: changes?.stockQuantity?.new || changes?.stockQuantity?.old || 0,
              price: typeof price === 'number' ? price : 0,
              total: changes?.stockQuantity?.new || changes?.stockQuantity?.old || 0,
              status: activity.type,
              notes: description,
              type: displayType,
              invoiceId: activity.invoiceId,
            }
          })
          setAllInvoices(formattedInvoices)
        }
      })
      .catch(err => {
        console.error('Error fetching activities:', err)
        setAllInvoices([])
      })
      .finally(() => setLoadingActivities(false))
  }, [motorcycle.id])

  const initials = motorcycle.brand && motorcycle.model
    ? `${motorcycle.brand[0]}${motorcycle.model[0]}`.toUpperCase()
    : 'MC'

  const handleEditSuccess = () => {
    router.refresh()
    setIsEditDialogOpen(false)
  }

  const handleDeleteSuccess = () => {
    router.push(`/${locale}/motorcycles`)
  }

  // Parse attachments (can be single string or JSON array)
  const parseAttachments = (): AttachmentItem[] => {
    if (!motorcycle.attachment) return []
    
    try {
      // Try to parse as JSON array
      const parsed = JSON.parse(motorcycle.attachment)
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
      const fileName = motorcycle.attachment.split('/').pop() || 'attachment'
      const extension = fileName.split('.').pop()?.toLowerCase() || ''
      return [{
        url: motorcycle.attachment,
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

      // Create FormData with existing motorcycle data and new attachments
      const formData = new FormData()
      formData.append('brand', motorcycle.brand)
      formData.append('model', motorcycle.model)
      formData.append('sku', motorcycle.sku)
      if (motorcycle.year) {
        formData.append('year', String(motorcycle.year))
      }
      if (motorcycle.engineSize) {
        formData.append('engineSize', motorcycle.engineSize)
      }
      if (motorcycle.vin) {
        formData.append('vin', motorcycle.vin)
      }
      if (motorcycle.color) {
        formData.append('color', motorcycle.color)
      }
      formData.append('usdRetailPrice', String(motorcycle.usdRetailPrice))
      formData.append('usdWholesalePrice', String(motorcycle.usdWholesalePrice))
      if (motorcycle.rmbPrice) {
        formData.append('rmbPrice', String(motorcycle.rmbPrice))
      }
      formData.append('stockQuantity', String(motorcycle.stockQuantity))
      formData.append('lowStockThreshold', String(motorcycle.lowStockThreshold))
      formData.append('status', motorcycle.status)
      if (motorcycle.notes) {
        formData.append('notes', motorcycle.notes)
      }

      // Append new attachments
      validFiles.forEach((file) => {
        formData.append('attachments', file)
      })

      // Append existing attachments to keep
      if (attachments.length > 0) {
        formData.append('existingAttachments', JSON.stringify(attachments.map(a => a.url)))
      }

      const response = await fetch(`/api/motorcycles/${motorcycle.id}`, {
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

  const getStatusBadge = (status: string) => {
    const statusColors = {
      IN_STOCK: 'bg-green-100 text-green-800',
      RESERVED: 'bg-yellow-100 text-yellow-800',
      SOLD: 'bg-blue-100 text-blue-800',
      OUT_OF_STOCK: 'bg-red-100 text-red-800',
    }
    return (
      <Badge className={cn(statusColors[status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800', fontClass)}>
        {status.replace('_', ' ')}
      </Badge>
    )
  }

  return (
    <div className={cn("flex flex-col gap-6 px-4 md:px-6 lg:px-8 pb-8", fontClass)} style={{ direction } as React.CSSProperties}>
      {/* Header with Back Button and Actions */}
      <div className="flex items-center justify-between pt-4">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.push(`/${locale}/motorcycles`)}
            className={fontClass}
          >
            <IconArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className={cn("text-3xl font-bold", fontClass)}>
            {motorcycle.brand} {motorcycle.model}
          </h1>
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
                  <CardTitle className={fontClass}>{t('detail.motorcycleImage')}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center gap-4">
                  <Avatar className="h-48 w-48">
                    <AvatarImage src={motorcycle.image || undefined} alt={`${motorcycle.brand} ${motorcycle.model}`} />
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
                      <label className={cn("text-sm font-medium text-muted-foreground", fontClass)}>{t('detail.sku')}</label>
                      <p className={cn("mt-1 text-sm font-mono", fontClass)}>{motorcycle.sku}</p>
                    </div>
                    <div>
                      <label className={cn("text-sm font-medium text-muted-foreground", fontClass)}>{t('detail.status')}</label>
                      <div className="mt-1">
                        {getStatusBadge(motorcycle.status)}
                      </div>
                    </div>
                    <div>
                      <label className={cn("text-sm font-medium text-muted-foreground", fontClass)}>{t('columns.brand')}</label>
                      <p className={cn("mt-1 text-sm", fontClass)}>{motorcycle.brand}</p>
                    </div>
                    <div>
                      <label className={cn("text-sm font-medium text-muted-foreground", fontClass)}>{t('columns.model')}</label>
                      <p className={cn("mt-1 text-sm", fontClass)}>{motorcycle.model}</p>
                    </div>
                    {motorcycle.year && (
                      <div>
                        <label className={cn("text-sm font-medium text-muted-foreground", fontClass)}>{t('detail.year')}</label>
                        <p className={cn("mt-1 text-sm", fontClass)}>{motorcycle.year}</p>
                      </div>
                    )}
                    {motorcycle.engineSize && (
                      <div>
                        <label className={cn("text-sm font-medium text-muted-foreground", fontClass)}>{t('detail.engineSize')}</label>
                        <p className={cn("mt-1 text-sm", fontClass)}>{motorcycle.engineSize}</p>
                      </div>
                    )}
                    {motorcycle.color && (
                      <div>
                        <label className={cn("text-sm font-medium text-muted-foreground", fontClass)}>{t('detail.color')}</label>
                        <p className={cn("mt-1 text-sm", fontClass)}>{motorcycle.color}</p>
                      </div>
                    )}
                    {motorcycle.vin && (
                      <div>
                        <label className={cn("text-sm font-medium text-muted-foreground", fontClass)}>{t('detail.vin')}</label>
                        <p className={cn("mt-1 text-sm font-mono", fontClass)}>{motorcycle.vin}</p>
                      </div>
                    )}
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
                        ${typeof motorcycle.usdRetailPrice === 'number' 
                          ? motorcycle.usdRetailPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                          : parseFloat(motorcycle.usdRetailPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        }
                      </p>
                    </div>
                    <div>
                      <label className={cn("text-sm font-medium text-muted-foreground", fontClass)}>{t('detail.wholesalePrice')}</label>
                      <p className={cn("mt-1 text-lg font-semibold", fontClass)}>
                        ${typeof motorcycle.usdWholesalePrice === 'number'
                          ? motorcycle.usdWholesalePrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                          : parseFloat(motorcycle.usdWholesalePrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        }
                      </p>
                    </div>
                    {motorcycle.rmbPrice && (
                      <div>
                        <label className={cn("text-sm font-medium text-muted-foreground", fontClass)}>{t('detail.rmbPrice')}</label>
                        <p className={cn("mt-1 text-lg font-semibold", fontClass)}>
                          ¥{typeof motorcycle.rmbPrice === 'number'
                            ? motorcycle.rmbPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                            : parseFloat(motorcycle.rmbPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                          }
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
                          {motorcycle.stockQuantity}
                        </span>
                        {motorcycle.lowStockThreshold > 0 && motorcycle.stockQuantity <= motorcycle.lowStockThreshold && (
                          <Badge variant="destructive" className={fontClass}>{t('detail.lowStock')}</Badge>
                        )}
                      </div>
                    </div>
                    {motorcycle.lowStockThreshold > 0 && (
                      <div>
                        <label className={cn("text-sm font-medium text-muted-foreground", fontClass)}>{t('detail.lowStockThreshold')}</label>
                        <p className={cn("mt-1 text-sm", fontClass)}>{motorcycle.lowStockThreshold}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Notes */}
              {motorcycle.notes && (
                <Card>
                  <CardHeader>
                    <CardTitle className={fontClass}>{t('detail.notes')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className={cn("text-sm whitespace-pre-wrap", fontClass)}>{motorcycle.notes}</p>
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
                          {format(new Date(motorcycle.createdAt), 'PPpp')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <IconCalendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <label className={cn("text-sm font-medium text-muted-foreground", fontClass)}>{t('detail.lastUpdated')}</label>
                        <p className={cn("text-sm", fontClass)}>
                          {format(new Date(motorcycle.updatedAt), 'PPpp')}
                        </p>
                      </div>
                    </div>
                    {motorcycle.createdBy && (
                      <div className="flex items-center gap-2">
                        <IconUser className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <label className={cn("text-sm font-medium text-muted-foreground", fontClass)}>{t('detail.createdBy')}</label>
                          <p className={cn("text-sm", fontClass)}>
                            {motorcycle.createdBy.name || motorcycle.createdBy.email}
                          </p>
                        </div>
                      </div>
                    )}
                    {motorcycle.updatedBy && (
                      <div className="flex items-center gap-2">
                        <IconUser className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <label className={cn("text-sm font-medium text-muted-foreground", fontClass)}>Updated By</label>
                          <p className={cn("text-sm", fontClass)}>
                            {motorcycle.updatedBy.name || motorcycle.updatedBy.email}
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
              <InvoiceTable
                data={allInvoices}
                loading={loadingActivities}
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
                                View
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
                PDF, DOC, XLS or images (max 10MB each)
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <MotorcycleDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSuccess={handleEditSuccess}
        motorcycle={motorcycle}
      />

      {/* Delete Dialog */}
      <DeleteMotorcycleDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onSuccess={handleDeleteSuccess}
        motorcycleName={`${motorcycle.brand} ${motorcycle.model}`}
        motorcycleId={motorcycle.id}
      />
    </div>
  )
}

// Invoice table component
function InvoiceTable({ 
  data, 
  loading,
  fontClass,
  columnSizing,
  setColumnSizing
}: { 
  data: InvoiceData[]
  loading: boolean
  fontClass: string
  columnSizing: ColumnSizingState
  setColumnSizing: (sizing: ColumnSizingState) => void
}) {
  const router = useRouter()
  const params = useParams()
  const locale = (params?.locale as string) || 'en'
  const t = useTranslations('motorcycles.detail')

  const columns: ColumnDef<InvoiceData>[] = [
    {
      accessorKey: 'invoiceNumber',
      header: 'Type',
      size: 150,
      minSize: 120,
      maxSize: 200,
      cell: ({ row }) => {
        // If it's a settings activity, show "Settings" badge
        if (row.original.type === 'settings') {
          return (
            <Badge className={cn("bg-purple-100 text-purple-800", fontClass)}>
              {t('settings')}
            </Badge>
          )
        }
        // If it has an invoice number, show it
        if (row.original.invoiceId || (row.original.invoiceNumber && row.original.invoiceNumber !== t('settings'))) {
          return (
            <span className={cn("text-sm font-mono", fontClass)}>
              {row.original.invoiceNumber}
            </span>
          )
        }
        // Fallback
        return (
          <span className={cn("text-sm font-mono", fontClass)}>
            {row.original.invoiceNumber || '-'}
          </span>
        )
      },
    },
    {
      accessorKey: 'date',
      header: t('date'),
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
      header: t('quantity'),
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
      header: t('price'),
      size: 120,
      minSize: 100,
      maxSize: 180,
      cell: ({ row }) => {
        const price = row.original.price
        if (!price || price === 0) {
          return <span className={cn("text-muted-foreground", fontClass)}>-</span>
        }
        return (
          <span className={cn("text-sm", fontClass)}>
            ${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        )
      },
    },
    {
      accessorKey: 'total',
      header: t('total'),
      size: 130,
      minSize: 110,
      maxSize: 200,
      cell: ({ row }) => (
        <span className={cn("text-sm font-medium", fontClass)}>
          ${row.original.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: t('reference'),
      size: 120,
      minSize: 100,
      maxSize: 150,
      cell: ({ row }) => {
        const status = row.original.status
        const statusColors: Record<string, string> = {
          DRAFT: 'bg-gray-100 text-gray-800',
          FINALIZED: 'bg-blue-100 text-blue-800',
          PAID: 'bg-green-100 text-green-800',
          PARTIALLY_PAID: 'bg-yellow-100 text-yellow-800',
          OVERDUE: 'bg-red-100 text-red-800',
          CANCELLED: 'bg-red-100 text-red-800',
        }
        return (
          <Badge className={cn(statusColors[status] || 'bg-gray-100 text-gray-800', fontClass)}>
            {status.replace('_', ' ')}
          </Badge>
        )
      },
    },
    {
      accessorKey: 'notes',
      header: t('notes'),
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
    return <div className={cn("text-center py-8 text-muted-foreground", fontClass)}>{t('detail.uploading')}</div>
  }

  if (data.length === 0) {
    return <div className={cn("text-center py-8 text-muted-foreground", fontClass)}>{t('detail.noAttachments')}</div>
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

