"use client"

import { useState } from 'react'
import * as React from 'react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { getTextDirection } from '@/lib/i18n'
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
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/use-toast'

interface DeleteProductDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  productName: string
  productId: string
}

export function DeleteProductDialog({ 
  open, 
  onOpenChange, 
  onSuccess, 
  productName,
  productId 
}: DeleteProductDialogProps) {
  const params = useParams()
  const locale = (params?.locale as string) || 'ku'
  const t = useTranslations('products.delete')
  const fontClass = locale === 'ku' ? 'font-kurdish' : 'font-engar'
  const direction = getTextDirection(locale as 'ku' | 'en' | 'ar')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  const handleDelete = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete product')
      }

      setIsLoading(false)
      onOpenChange(false)
      
      // Show success toast
      toast({
        title: t('productDeleted'),
        description: t('productDeletedSuccess', { name: productName }),
      })
      
      if (onSuccess) {
        onSuccess()
      }
    } catch (err) {
      console.error('Error deleting product:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete product'
      setError(errorMessage)
      setIsLoading(false)
      
      // Show error toast
      toast({
        title: t('deleteFailed'),
        description: errorMessage,
        variant: 'destructive',
      })
    }
  }

  const handleCancel = () => {
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
            className={cn(direction === 'rtl' && 'text-right', fontClass)}
            style={{ direction } as React.CSSProperties}
          >
            {t('title')}
          </AlertDialogTitle>
          <AlertDialogDescription 
            className={cn(direction === 'rtl' && 'text-right', fontClass)}
            style={{ direction } as React.CSSProperties}
          >
            {t('confirmMessage')}
            <br />
            <strong className={cn("mt-2 block", fontClass)}>{productName}</strong>
            <br />
            {t('cannotUndo')}
          </AlertDialogDescription>
        </AlertDialogHeader>

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
            {t('cancel')}
          </AlertDialogCancel>
          <Button
            onClick={handleDelete}
            disabled={isLoading}
            variant="destructive"
            className={fontClass}
          >
            {isLoading ? (
              <>
                <Spinner className="mr-2 h-4 w-4" />
                {t('deleting')}
              </>
            ) : (
              t('delete')
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

