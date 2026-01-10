"use client"

import { useState, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { getTextDirection } from '@/lib/i18n'
import { IconCamera, IconUser } from '@tabler/icons-react'
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

interface AccountDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: {
    name: string
    email: string
    avatar: string
  }
}

export function AccountDialog({ open, onOpenChange, user: initialUser }: AccountDialogProps) {
  const { data: session, update } = useSession()
  const params = useParams()
  const locale = (params?.locale as string) || 'ku'
  const t = useTranslations('user')
  const tAccount = useTranslations('accountDialog')
  
  const [name, setName] = useState(initialUser.name)
  const [avatar, setAvatar] = useState(initialUser.avatar)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Get font class based on locale
  const fontClass = locale === 'ku' ? 'font-kurdish' : 'font-engar'
  const direction = getTextDirection(locale as 'ku' | 'en' | 'ar')

  // Get initials for avatar fallback
  const initials = name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || initialUser.email[0].toUpperCase()

  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file')
        return
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size must be less than 5MB')
        return
      }

      setAvatarFile(file)
      setError(null)
      
      // Create preview
      const reader = new FileReader()
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSave = async (e?: React.MouseEvent) => {
    e?.preventDefault()
    e?.stopPropagation()
    
    setIsLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('name', name.trim())
      if (avatarFile) {
        formData.append('avatar', avatarFile)
      }

      const response = await fetch('/api/user/profile', {
        method: 'PATCH',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update profile')
      }

      // Update local state
      setAvatar(data.user.avatar || null)
      setAvatarFile(null)
      setAvatarPreview(null)

      // Update session
      await update({
        ...session,
        user: {
          ...session?.user,
          name: data.user.name,
          image: data.user.avatar || null,
        },
      })

      // Close dialog after successful save
      setIsLoading(false)
      onOpenChange(false)
    } catch (err) {
      console.error('Error updating profile:', err)
      setError(err instanceof Error ? err.message : 'Failed to update profile')
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    setName(initialUser.name)
    setAvatar(initialUser.avatar)
    setAvatarFile(null)
    setAvatarPreview(null)
    setError(null)
    onOpenChange(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent 
        className={cn("sm:max-w-md", fontClass)} 
        style={{ direction } as React.CSSProperties}
      >
        <AlertDialogHeader>
          <AlertDialogTitle 
            className={cn(direction === 'rtl' && 'text-right')}
            style={{ direction } as React.CSSProperties}
          >
            {tAccount('editProfile')}
          </AlertDialogTitle>
          <AlertDialogDescription 
            className={cn(direction === 'rtl' && 'text-right')}
            style={{ direction } as React.CSSProperties}
          >
            {tAccount('editProfileDescription')}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex flex-col gap-6 py-4">
          {/* Avatar Section */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <Avatar className="h-24 w-24">
                <AvatarImage 
                  src={avatarPreview || (avatar ? (avatar.startsWith('/') ? avatar : `/${avatar}`) : undefined)} 
                  alt={name} 
                />
                <AvatarFallback className="text-2xl">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={handleAvatarClick}
                className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md hover:bg-primary/90"
              >
                <IconCamera className="h-4 w-4" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
            <p className={cn("text-sm text-muted-foreground text-center", fontClass)}>
              {tAccount('clickToChangeAvatar')}
            </p>
          </div>

          {/* Name Input */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">{tAccount('name')}</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={tAccount('namePlaceholder')}
              className={fontClass}
            />
          </div>

          {/* Email (Read-only) */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">{tAccount('email')}</Label>
            <Input
              id="email"
              value={initialUser.email}
              disabled
              className={cn("bg-muted", fontClass)}
            />
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={handleCancel}
            disabled={isLoading}
            className={fontClass}
          >
            {tAccount('cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleSave}
            disabled={isLoading || !name.trim()}
            className={fontClass}
          >
            {isLoading ? (
              <>
                <Spinner className="mr-2 h-4 w-4" />
                {tAccount('saving')}
              </>
            ) : (
              tAccount('save')
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

