"use client"

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'
import { getTextDirection } from '@/lib/i18n'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { HelpDialog } from '@/components/help-dialog'
import { cn } from '@/lib/utils'
import { IconSettings, IconMinus, IconPlus, IconMoon, IconSun, IconHelp } from '@tabler/icons-react'

export default function SettingsPage() {
  const params = useParams()
  const locale = (params?.locale as string) || 'ku'
  const t = useTranslations('settings')
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const fontClass = locale === 'ku' ? 'font-kurdish' : 'font-engar'
  const direction = getTextDirection(locale as 'ku' | 'en' | 'ar')
  const [isHelpDialogOpen, setIsHelpDialogOpen] = useState(false)

  // Font size state (stored in localStorage, default: 90%)
  const [fontSize, setFontSize] = useState(90)

  // Load font size from localStorage on mount
  useEffect(() => {
    setMounted(true)
    const savedFontSize = localStorage.getItem('app-font-size')
    if (savedFontSize) {
      setFontSize(parseInt(savedFontSize))
    } else {
      // Set default to 90% if no saved value exists
      setFontSize(90)
      localStorage.setItem('app-font-size', '90')
    }
  }, [])

  // Apply font size to document root
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.style.fontSize = `${fontSize}%`
    }
  }, [fontSize])

  // Save font size to localStorage
  const handleFontSizeChange = (value: number[]) => {
    const newSize = value[0]
    setFontSize(newSize)
    localStorage.setItem('app-font-size', String(newSize))
  }

  const decreaseFontSize = () => {
    const newSize = Math.max(75, fontSize - 5)
    setFontSize(newSize)
    localStorage.setItem('app-font-size', String(newSize))
  }

  const increaseFontSize = () => {
    const newSize = Math.min(150, fontSize + 5)
    setFontSize(newSize)
    localStorage.setItem('app-font-size', String(newSize))
  }

  const resetFontSize = () => {
    setFontSize(90)
    localStorage.setItem('app-font-size', '90')
  }

  if (!mounted) {
    return null
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className={cn("text-3xl font-bold", fontClass)}>{t('title')}</h1>
        <p className={cn("text-muted-foreground mt-1", fontClass)}>
          {t('description')}
        </p>
      </div>

      <div className="grid gap-6">
        {/* Font Size Settings */}
        <Card>
          <CardHeader>
            <CardTitle className={cn("flex items-center gap-2", fontClass)}>
              <IconSettings className="h-5 w-5" />
              {t('fontSize.title')}
            </CardTitle>
            <CardDescription className={fontClass}>
              {t('fontSize.description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="font-size" className={fontClass}>{t('fontSize.label', { size: fontSize })}</Label>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={decreaseFontSize}
                    disabled={fontSize <= 75}
                    className={fontClass}
                  >
                    <IconMinus className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={increaseFontSize}
                    disabled={fontSize >= 150}
                    className={fontClass}
                  >
                    <IconPlus className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetFontSize}
                    className={fontClass}
                  >
                    {t('fontSize.reset')}
                  </Button>
                </div>
              </div>
              <Slider
                id="font-size"
                min={75}
                max={150}
                step={5}
                value={[fontSize]}
                onValueChange={handleFontSizeChange}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span className={fontClass}>{t('fontSize.small')}</span>
                <span className={fontClass}>{t('fontSize.default')}</span>
                <span className={fontClass}>{t('fontSize.large')}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Theme Settings */}
        <Card>
          <CardHeader>
            <CardTitle className={cn("flex items-center gap-2", fontClass)}>
              {theme === 'dark' ? (
                <IconMoon className="h-5 w-5" />
              ) : (
                <IconSun className="h-5 w-5" />
              )}
              {t('theme.title')}
            </CardTitle>
            <CardDescription className={fontClass}>
              {t('theme.description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="theme" className={fontClass}>{t('theme.label')}</Label>
              <Select value={theme} onValueChange={setTheme}>
                <SelectTrigger id="theme" className={fontClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={fontClass}>
                  <SelectItem value="light">
                    <div className="flex items-center gap-2">
                      <IconSun className="h-4 w-4" />
                      <span>{t('theme.light')}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="dark">
                    <div className="flex items-center gap-2">
                      <IconMoon className="h-4 w-4" />
                      <span>{t('theme.dark')}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="system">
                    <div className="flex items-center gap-2">
                      <IconSettings className="h-4 w-4" />
                      <span>{t('theme.system')}</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Other Settings */}
        <Card>
          <CardHeader>
            <CardTitle className={cn("flex items-center gap-2", fontClass)}>
              <IconSettings className="h-5 w-5" />
              {t('additional.title')}
            </CardTitle>
            <CardDescription className={fontClass}>
              {t('additional.description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Add more settings here as needed */}
            <div className="text-sm text-muted-foreground">
              <p className={fontClass}>{t('additional.comingSoon')}</p>
            </div>
          </CardContent>
        </Card>

        <Separator />

        {/* Request New Settings */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className={cn("flex items-center gap-2", fontClass)}>
              <IconHelp className="h-5 w-5" />
              {t('requestNew.title')}
            </CardTitle>
            <CardDescription className={fontClass}>
              {t('requestNew.description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => setIsHelpDialogOpen(true)}
              variant="default"
              className={cn("w-full sm:w-auto", fontClass)}
            >
              <IconHelp className="h-4 w-4 mr-2" />
              {t('requestNew.contactUs')}
            </Button>
          </CardContent>
        </Card>
      </div>

      <HelpDialog open={isHelpDialogOpen} onOpenChange={setIsHelpDialogOpen} />
    </div>
  )
}

