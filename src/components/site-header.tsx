"use client"

import { useState, useEffect } from 'react'
import { useParams, usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { getTextDirection } from '@/lib/i18n'
import { 
  IconMaximize,
  IconMaximizeOff 
} from '@tabler/icons-react'
import { NotificationDropdown } from './layout/notification-dropdown'
import { GlobalSearch } from './global-search'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import 'flag-icons/css/flag-icons.min.css'

export function SiteHeader() {
  const params = useParams()
  const pathname = usePathname()
  const locale = (params?.locale as string) || 'ku'
  const tLang = useTranslations('language')
  const t = useTranslations('navigation')
  const [isFullscreen, setIsFullscreen] = useState(false)
  
  // Get font class based on locale
  const fontClass = locale === 'ku' ? 'font-kurdish' : 'font-engar'
  const direction = getTextDirection(locale as 'ku' | 'en' | 'ar')

  const handleLocaleChange = (newLocale: string) => {
    const pathWithoutLocale = pathname.replace(/^\/(ku|en|ar)/, '') || '/dashboard'
    window.location.href = `/${newLocale}${pathWithoutLocale}`
  }

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [])

  // Get page title based on pathname
  const getPageTitle = () => {
    const pathWithoutLocale = pathname.replace(/^\/(ku|en|ar)/, '') || '/dashboard'
    
    if (pathWithoutLocale.startsWith('/products')) {
      return t('products')
    } else if (pathWithoutLocale.startsWith('/motorcycles')) {
      return t('motorcycle')
    } else if (pathWithoutLocale.startsWith('/customers')) {
      return t('customers')
    } else if (pathWithoutLocale.startsWith('/sales')) {
      return t('sales')
    } else if (pathWithoutLocale.startsWith('/invoices')) {
      return t('invoices')
    } else if (pathWithoutLocale.startsWith('/employees')) {
      return t('employees')
    } else if (pathWithoutLocale.startsWith('/activities')) {
      return t('activities')
    } else if (pathWithoutLocale.startsWith('/settings')) {
      return t('settings')
    } else if (pathWithoutLocale.startsWith('/help')) {
      return t('help')
    } else if (pathWithoutLocale.startsWith('/search')) {
      return t('search')
    }
    return t('dashboard')
  }

  const pageTitle = getPageTitle()
  const isRTL = direction === 'rtl'

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        {/* Sidebar Trigger, Separator, and Page Title - Left side for both RTL and LTR */}
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <h1 className={cn("text-base font-medium", fontClass)}>{pageTitle}</h1>
        <div className="flex-1" />

        {/* Controls (Search, Notifications, Fullscreen, Language) - Right side for both RTL and LTR */}
        {isRTL ? (
          <div className="flex items-center gap-2">
            {/* Search Bar */}
            <GlobalSearch />
            
            {/* Notifications */}
            <NotificationDropdown />
            
            {/* Fullscreen Toggle */}
            <Button variant="ghost" size="icon" onClick={toggleFullscreen}>
              {isFullscreen ? (
                <IconMaximizeOff className="h-5 w-5" />
              ) : (
                <IconMaximize className="h-5 w-5" />
              )}
            </Button>
            
            {/* Language Switcher */}
            <div suppressHydrationWarning>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className={fontClass}>
                    {locale === 'ku' && <span className="fi fi-tj ml-2" />}
                    {locale === 'ar' && <span className="fi fi-iq ml-2" />}
                    {locale === 'en' && <span className="fi fi-gb ml-2" />}
                    {tLang('label')}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  className={cn("w-56", fontClass)} 
                  style={{ direction } as React.CSSProperties}
                  align="start"
                >
                  <DropdownMenuLabel>{tLang('title')}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuRadioGroup value={locale} onValueChange={handleLocaleChange}>
                    <DropdownMenuRadioItem value="ku" className="font-kurdish">
                      <div className="flex items-center gap-2">
                        <span className="fi fi-tj"></span>
                        <span>{tLang('kurdish')}</span>
                      </div>
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="ar" className="font-engar">
                      <div className="flex items-center gap-2">
                        <span className="fi fi-iq"></span>
                        <span>{tLang('arabic')}</span>
                      </div>
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="en" className="font-engar">
                      <div className="flex items-center gap-2">
                        <span className="fi fi-gb"></span>
                        <span>{tLang('english')}</span>
                      </div>
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {/* Search Bar */}
            <GlobalSearch />
            
            {/* Notifications */}
            <NotificationDropdown />
            
            {/* Fullscreen Toggle */}
            <Button variant="ghost" size="icon" onClick={toggleFullscreen}>
              {isFullscreen ? (
                <IconMaximizeOff className="h-5 w-5" />
              ) : (
                <IconMaximize className="h-5 w-5" />
              )}
            </Button>
            
            {/* Language Switcher */}
            <div suppressHydrationWarning>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className={fontClass}>
                    {locale === 'ku' && <span className="fi fi-tj mr-2" />}
                    {locale === 'ar' && <span className="fi fi-iq mr-2" />}
                    {locale === 'en' && <span className="fi fi-gb mr-2" />}
                    {tLang('label')}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  className={cn("w-56", fontClass)} 
                  style={{ direction } as React.CSSProperties}
                  align="end"
                >
                  <DropdownMenuLabel>{tLang('title')}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuRadioGroup value={locale} onValueChange={handleLocaleChange}>
                    <DropdownMenuRadioItem value="ku" className="font-kurdish">
                      <div className="flex items-center gap-2">
                        <span className="fi fi-tj"></span>
                        <span>{tLang('kurdish')}</span>
                      </div>
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="ar" className="font-engar">
                      <div className="flex items-center gap-2">
                        <span className="fi fi-iq"></span>
                        <span>{tLang('arabic')}</span>
                      </div>
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="en" className="font-engar">
                      <div className="flex items-center gap-2">
                        <span className="fi fi-gb"></span>
                        <span>{tLang('english')}</span>
                      </div>
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
