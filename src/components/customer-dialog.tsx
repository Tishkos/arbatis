"use client"

import { useState, useRef, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { getTextDirection } from '@/lib/i18n'
import { IconCamera, IconX, IconPaperclip, IconRefresh } from '@tabler/icons-react'
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
import { cn, generateSkuCode } from '@/lib/utils'
import { Plus, Edit } from 'lucide-react'

type Customer = {
  id: string
  name: string
  sku: string
  phone: string | null
  email: string | null
  addressId: string | null
  address: {
    id: string
    name: string
  } | null
  image: string | null
  debtIqd: number | string
  debtUsd: number | string
  attachment: string | null
  notes: string | null
  notificationDays: number | null
  notificationType: string | null
}

interface CustomerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  addresses?: { id: string; name: string }[]
  customer?: Customer | null
}

export function CustomerDialog({ open, onOpenChange, onSuccess, addresses = [], customer }: CustomerDialogProps) {
  const isEditMode = !!customer
  const params = useParams()
  const locale = (params?.locale as string) || 'ku'
  const t = useTranslations('customers')
  const fontClass = locale === 'ku' ? 'font-kurdish' : 'font-engar'
  const direction = getTextDirection(locale as 'ku' | 'en' | 'ar')
  
  const [name, setName] = useState('')
  const [sku, setSku] = useState('')
  // Customer type is always INDIVIDUAL - removed type selection
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [addressId, setAddressId] = useState<string>('')
  const [newAddressName, setNewAddressName] = useState('')
  const [showNewAddress, setShowNewAddress] = useState(false)
  const [debtIqd, setDebtIqd] = useState('')
  const [debtUsd, setDebtUsd] = useState('')
  const [notes, setNotes] = useState('')
  const [notificationDays, setNotificationDays] = useState<string>('')
  const [notificationType, setNotificationType] = useState<'partial' | 'full'>('partial')
  const [notificationEnabled, setNotificationEnabled] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([])
  const [existingAttachments, setExistingAttachments] = useState<Array<{ url: string; name: string; type: string }>>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const attachmentInputRef = useRef<HTMLInputElement>(null)

  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'CU'

  useEffect(() => {
    if (customer && open) {
      setName(customer.name || '')
      setSku(customer.sku || '')
      // Type is always INDIVIDUAL
      setPhone(customer.phone || '')
      setEmail(customer.email || '')
      setAddressId(customer.addressId || '')
      setNewAddressName('')
      setShowNewAddress(false)
      setDebtIqd(String(customer.debtIqd || '0'))
      setDebtUsd(String(customer.debtUsd || '0'))
      setNotes(customer.notes || '')
      setNotificationDays(customer.notificationDays ? String(customer.notificationDays) : '')
      setNotificationType((customer.notificationType as 'partial' | 'full') || 'partial')
      setNotificationEnabled(customer.notificationDays !== null && customer.notificationDays > 0)
      setImagePreview(customer.image || null)
      setImageFile(null)
      setAttachmentFiles([])
      setError(null)
      
      // Parse existing attachments
      if (customer.attachment) {
        try {
          const parsed = JSON.parse(customer.attachment)
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
            const fileName = customer.attachment.split('/').pop() || 'attachment'
            const extension = fileName.split('.').pop()?.toLowerCase() || ''
            setExistingAttachments([{ url: customer.attachment, name: fileName, type: extension }])
          }
        } catch {
          const fileName = customer.attachment.split('/').pop() || 'attachment'
          const extension = fileName.split('.').pop()?.toLowerCase() || ''
          setExistingAttachments([{ url: customer.attachment, name: fileName, type: extension }])
        }
      } else {
        setExistingAttachments([])
      }
    } else if (!customer && open) {
      setName('')
      setSku(generateSkuCode()) // Auto-generate SKU for new customers
      setPhone('')
      setEmail('')
      setAddressId('')
      setNewAddressName('')
      setShowNewAddress(false)
      setDebtIqd('')
      setDebtUsd('')
      setNotes('')
      setNotificationDays('')
      setNotificationType('partial')
      setNotificationEnabled(false)
      setImageFile(null)
      setImagePreview(null)
      setAttachmentFiles([])
      setExistingAttachments([])
      setError(null)
    }
  }, [customer, open])

  const handleImageClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError(t('dialog.imageSize'))
        return
      }
      setImageFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleRemoveImage = () => {
    setImageFile(null)
    setImagePreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleAttachmentClick = () => {
    attachmentInputRef.current?.click()
  }

  const handleAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) {
      const validFiles: File[] = []
      for (const file of files) {
        if (file.size > 10 * 1024 * 1024) {
          setError(t('dialog.fileSize', { name: file.name }))
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

  const handleSave = async () => {
    setIsLoading(true)
    setError(null)

    try {
      if (!name.trim()) {
        setError(t('dialog.nameRequired'))
        setIsLoading(false)
        return
      }
      if (!sku.trim()) {
        setError(t('dialog.codeRequired'))
        setIsLoading(false)
        return
      }

      const formData = new FormData()
      formData.append('name', name.trim())
      formData.append('sku', sku.trim())
      formData.append('type', 'INDIVIDUAL') // Always INDIVIDUAL
      if (phone) formData.append('phone', phone.trim())
      if (email) formData.append('email', email.trim())
      if (addressId && !showNewAddress) {
        formData.append('addressId', addressId)
      }
      if (showNewAddress && newAddressName.trim()) {
        formData.append('newAddressName', newAddressName.trim())
      }
      formData.append('debtIqd', debtIqd || '0')
      formData.append('debtUsd', debtUsd || '0')
      if (notes) formData.append('notes', notes.trim())
      
      // Notification settings
      if (notificationEnabled && notificationDays) {
        formData.append('notificationDays', notificationDays)
        formData.append('notificationType', notificationType)
      } else {
        formData.append('notificationDays', '')
      }
      
      if (imageFile) {
        formData.append('image', imageFile)
      }
      
      // If editing and no new image, send existing image URL
      if (isEditMode && !imageFile && customer?.image) {
        formData.append('existingImage', customer.image)
      }
      
      // If editing and removing image
      if (isEditMode && !imagePreview && customer?.image) {
        formData.append('removeImage', 'true')
      }

      // Append new attachments
      attachmentFiles.forEach((file, index) => {
        formData.append(`attachments`, file)
      })
      
      // Append existing attachments to keep (as JSON)
      if (existingAttachments.length > 0) {
        formData.append('existingAttachments', JSON.stringify(existingAttachments.map(a => a.url)))
      }

      const url = isEditMode ? `/api/customers/${customer.id}` : '/api/customers'
      const method = isEditMode ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        const errorMsg = data.error || (isEditMode ? t('dialog.updating') : t('dialog.creating'))
        if (data.error && (data.error.includes('SKU') || data.error.includes('Code'))) {
          throw new Error(data.error)
        }
        throw new Error(errorMsg)
      }

      setIsLoading(false)
      onOpenChange(false)
      if (onSuccess) {
        onSuccess()
      }
    } catch (err) {
      console.error('Error saving customer:', err)
      setError(err instanceof Error ? err.message : (isEditMode ? t('dialog.updating') : t('dialog.creating')))
      setIsLoading(false)
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
                    {t('dialog.editTitle')}
                  </>
                ) : (
                  <>
                    <Plus className="h-5 w-5" />
                    {t('dialog.addTitle')}
                  </>
                )}
              </AlertDialogTitle>
              <AlertDialogDescription 
                className={cn(direction === 'rtl' && 'text-right', fontClass, "mt-1")}
                style={{ direction } as React.CSSProperties}
              >
                {isEditMode ? t('dialog.editDescription') : t('dialog.addDescription')}
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="basic" className={fontClass}>{t('dialog.basicInfo')}</TabsTrigger>
            <TabsTrigger value="debt" className={fontClass}>{t('dialog.debtInfo')}</TabsTrigger>
            <TabsTrigger value="notifications" className={fontClass}>{t('dialog.notifications')}</TabsTrigger>
            <TabsTrigger value="attachments" className={fontClass}>{t('dialog.attachments')}</TabsTrigger>
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
                      alt={name || 'Customer'} 
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
                  {imagePreview && (
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="absolute top-0 right-0 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-lg hover:bg-destructive/90 transition-all z-10"
                      aria-label="Remove image"
                    >
                      <IconX className="h-4 w-4 text-white" />
                    </button>
                  )}
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className={cn(fontClass, "flex items-center gap-1")}>
                      {t('dialog.name')} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t('dialog.namePlaceholder')}
                      className={fontClass}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sku" className={cn(fontClass, "flex items-center gap-1")}>
                      {t('dialog.code')} <span className="text-destructive">*</span>
                    </Label>
                    <div className="flex gap-2">
                    <Input
                      id="sku"
                      value={sku}
                      onChange={(e) => setSku(e.target.value)}
                      placeholder={t('dialog.codePlaceholder')}
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
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone" className={fontClass}>{t('dialog.phone')}</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={t('dialog.phonePlaceholder')}
                    className={fontClass}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className={fontClass}>{t('dialog.email')}</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('dialog.emailPlaceholder')}
                    className={fontClass}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address" className={fontClass}>{t('dialog.address')}</Label>
                  {!showNewAddress ? (
                    <Select
                      value={addressId || "none"}
                      onValueChange={(value) => {
                        if (value === "new") {
                          setShowNewAddress(true)
                          setAddressId('')
                        } else if (value !== "none") {
                          setAddressId(value)
                        } else {
                          setAddressId('')
                        }
                      }}
                    >
                      <SelectTrigger className={fontClass} id="address">
                        <SelectValue placeholder={t('dialog.selectAddress')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t('dialog.noAddress')}</SelectItem>
                        {addresses.map((addr) => (
                          <SelectItem key={addr.id} value={addr.id}>
                            {addr.name}
                          </SelectItem>
                        ))}
                        <SelectItem value="new">{t('dialog.createNew')}</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        value={newAddressName}
                        onChange={(e) => setNewAddressName(e.target.value)}
                        placeholder={t('dialog.newAddressName')}
                        className={cn("flex-1", fontClass)}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setShowNewAddress(false)
                          setNewAddressName('')
                        }}
                        className={fontClass}
                      >
                        {t('dialog.cancel')}
                      </Button>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes" className={fontClass}>{t('dialog.notes')}</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={t('dialog.notesPlaceholder')}
                    className={fontClass}
                    rows={3}
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          {/* DEBT TAB */}
          <TabsContent value="debt" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div className="rounded-lg border p-4 space-y-4 bg-muted/30">
                <div>
                  <Label className={cn(fontClass, "text-base font-semibold")}>
                    {t('dialog.debtInfo')}
                  </Label>
                  <p className={cn("text-sm text-muted-foreground mt-1", fontClass)}>
                    {t('dialog.debtDescription')}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="debtIqd" className={fontClass}>{t('dialog.debtIqd')}</Label>
                    <Input
                      id="debtIqd"
                      type="number"
                      step="0.01"
                      min="0"
                      value={debtIqd}
                      onChange={(e) => setDebtIqd(e.target.value)}
                      placeholder={t('dialog.debtPlaceholder')}
                      className={fontClass}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="debtUsd" className={fontClass}>{t('dialog.debtUsd')}</Label>
                    <Input
                      id="debtUsd"
                      type="number"
                      step="0.01"
                      min="0"
                      value={debtUsd}
                      onChange={(e) => setDebtUsd(e.target.value)}
                      placeholder={t('dialog.debtPlaceholder')}
                      className={fontClass}
                    />
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* NOTIFICATIONS TAB */}
          <TabsContent value="notifications" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div className="rounded-lg border p-4 space-y-4 bg-muted/30">
                <div>
                  <Label className={cn(fontClass, "text-base font-semibold")}>
                    {t('dialog.notificationTitle')}
                  </Label>
                  <p className={cn("text-sm text-muted-foreground mt-1", fontClass)}>
                    {t('dialog.notificationDescription')}
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="notification-enabled" className={cn(fontClass, "text-sm font-medium")}>
                        {t('dialog.enableNotifications')}
                      </Label>
                      <p className={cn("text-xs text-muted-foreground", fontClass)}>
                        {t('dialog.enableNotificationsDesc')}
                      </p>
                    </div>
                    <Switch
                      id="notification-enabled"
                      checked={notificationEnabled}
                      onCheckedChange={(checked) => {
                        setNotificationEnabled(checked)
                        if (!checked) {
                          setNotificationDays('')
                        }
                      }}
                    />
                  </div>

                  {notificationEnabled && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="notification-days" className={cn(fontClass, "flex items-center gap-1")}>
                          {t('dialog.daysThreshold')} <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="notification-days"
                          type="number"
                          min="1"
                          value={notificationDays}
                          onChange={(e) => setNotificationDays(e.target.value)}
                          placeholder={t('dialog.daysThresholdPlaceholder')}
                          className={fontClass}
                        />
                        <p className={cn("text-xs text-muted-foreground", fontClass)}>
                          {t('dialog.daysThresholdDesc')}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="notification-type" className={fontClass}>
                          {t('dialog.notificationType')} <span className="text-destructive">*</span>
                        </Label>
                        <Select
                          value={notificationType}
                          onValueChange={(value: 'partial' | 'full') => setNotificationType(value)}
                        >
                          <SelectTrigger className={fontClass} id="notification-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="partial">{t('dialog.partialPayment')}</SelectItem>
                            <SelectItem value="full">{t('dialog.fullPayment')}</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className={cn("text-xs text-muted-foreground", fontClass)}>
                          {notificationType === 'partial' 
                            ? t('dialog.partialPaymentDesc')
                            : t('dialog.fullPaymentDesc')}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ATTACHMENTS TAB */}
          <TabsContent value="attachments" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div>
                <Label className={cn(fontClass, "text-base font-semibold")}>
                  {t('dialog.attachmentsTitle')}
                </Label>
                <p className={cn("text-sm text-muted-foreground mt-1", fontClass)}>
                  {t('dialog.attachmentsDescription')}
                </p>
              </div>

              {/* Existing Attachments */}
              {existingAttachments.length > 0 && (
                <div className="space-y-2">
                  {existingAttachments.map((attachment, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 border rounded-md bg-muted/50"
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
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={handleCancel}
            disabled={isLoading}
            className={fontClass}
          >
            {t('dialog.cancel')}
          </AlertDialogCancel>
          <Button
            onClick={handleSave}
            disabled={isLoading}
            className={fontClass}
          >
            {isLoading ? (
              <>
                <Spinner className="mr-2 h-4 w-4" />
                {isEditMode ? t('dialog.updating') : t('dialog.creating')}
              </>
            ) : (
              isEditMode ? t('dialog.update') : t('dialog.create')
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

