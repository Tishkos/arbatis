"use client"

import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { getTextDirection } from '@/lib/i18n'
import { IconHelp, IconBrandWhatsapp, IconPhone } from '@tabler/icons-react'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog-animated'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface HelpDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function HelpDialog({ open, onOpenChange }: HelpDialogProps) {
  const params = useParams()
  const locale = (params?.locale as string) || 'ku'
  const t = useTranslations('help')
  const fontClass = locale === 'ku' ? 'font-kurdish' : 'font-engar'
  const direction = getTextDirection(locale as 'ku' | 'en' | 'ar')

  const phoneNumber = '+36 20 441 6766'
  const whatsappUrl = `https://wa.me/${phoneNumber.replace(/\D/g, '')}`

  const handleWhatsAppClick = () => {
    window.open(whatsappUrl, '_blank')
  }

  const handlePhoneClick = () => {
    window.location.href = `tel:${phoneNumber}`
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent 
        className={cn("!max-w-[600px] w-[100vw] max-h-[90vh] overflow-y-auto", fontClass)} 
        style={{ direction } as React.CSSProperties}
      >
        <AlertDialogHeader>
          <AlertDialogTitle 
            className={cn(direction === 'rtl' && 'text-right', fontClass, "text-xl flex items-center gap-2")}
            style={{ direction } as React.CSSProperties}
          >
            <IconHelp className="h-5 w-5" />
            {t('title')}
          </AlertDialogTitle>
          <AlertDialogDescription 
            className={cn(direction === 'rtl' && 'text-right', fontClass, "mt-1")}
            style={{ direction } as React.CSSProperties}
          >
            {t('description')}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-6 py-4">
          {/* Contact Information */}
          <div className="space-y-4">
            <div className={cn("text-sm font-medium", fontClass)}>
              {t('getInTouch')}
            </div>

            {/* WhatsApp Contact */}
            <div className="flex items-center gap-4 p-4 border rounded-lg hover:bg-accent transition-colors">
              <div className="flex-shrink-0">
                <div className="h-12 w-12 rounded-full bg-green-500 flex items-center justify-center">
                  <IconBrandWhatsapp className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className={cn("text-sm font-medium mb-1", fontClass)}>
                  {t('whatsapp')}
                </div>
                <div className={cn("text-sm text-muted-foreground", fontClass)}>
                  {phoneNumber}
                </div>
              </div>
              <Button
                onClick={handleWhatsAppClick}
                className={cn("bg-green-500 hover:bg-green-600 text-white", fontClass)}
                size="sm"
              >
                <IconBrandWhatsapp className="h-4 w-4 mr-2" />
                {t('openWhatsApp')}
              </Button>
            </div>

            {/* Phone Contact */}
            <div className="flex items-center gap-4 p-4 border rounded-lg hover:bg-accent transition-colors">
              <div className="flex-shrink-0">
                <div className="h-12 w-12 rounded-full bg-blue-500 flex items-center justify-center">
                  <IconPhone className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className={cn("text-sm font-medium mb-1", fontClass)}>
                  {t('phone')}
                </div>
                <div className={cn("text-sm text-muted-foreground", fontClass)}>
                  {phoneNumber}
                </div>
              </div>
              <Button
                onClick={handlePhoneClick}
                variant="outline"
                className={fontClass}
                size="sm"
              >
                <IconPhone className="h-4 w-4 mr-2" />
                {t('call')}
              </Button>
            </div>
          </div>

          {/* Information Section */}
          <div className="pt-4 border-t">
            <div className={cn("text-sm text-muted-foreground space-y-2", fontClass)}>
              <p>
                {t('infoText1')}
              </p>
              <p>
                {t('infoText2')}
              </p>
            </div>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel className={fontClass}>{t('close')}</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

