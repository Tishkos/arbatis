"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { getTextDirection } from "@/lib/i18n"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { IconPackage, IconMotorbike, IconShoppingCart, IconTrendingUp } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { SalesStatistics } from "@/components/sales-statistics"
import { SalesActivitiesTable } from "@/components/sales-activities-table"

type SalesOption = {
  title: string
  url: string
  icon: React.ComponentType<{ className?: string }>
  description?: string
}

const SalesIcon = ({ isWholesale, isMotorcycle }: { isWholesale: boolean; isMotorcycle: boolean }) => {
  if (isMotorcycle) {
    if (isWholesale) {
      return (
        <div className="relative flex items-center justify-center w-7 h-7">
          <IconMotorbike className="h-6 w-6 text-primary absolute bottom-2 right-2" />
          <IconMotorbike className="h-6 w-6 text-primary opacity-50 absolute top-2 left-2" />
        </div>
      )
    } else {
      return <IconMotorbike className="h-6 w-6 text-primary" />
    }
  } else {
    if (isWholesale) {
      return (
        <div className="relative flex items-center justify-center w-7 h-7">
          <IconPackage className="h-6 w-6 text-primary absolute bottom-2 right-2" />
          <IconPackage className="h-6 w-6 text-primary opacity-50 absolute top-2 left-2" />
        </div>
      )
    } else {
      return <IconPackage className="h-6 w-6 text-primary" />
    }
  }
}

export function SalesPage({ locale }: { locale: string }) {
  const t = useTranslations('navigation')
  const fontClass = locale === 'ku' ? 'font-kurdish' : 'font-engar'
  const direction = getTextDirection(locale as 'ku' | 'en' | 'ar')

  const salesOptions: SalesOption[] = [
    {
      title: t('salesOptions.wholesaleProduct.title'),
      url: `/${locale}/sales/wholesale-product`,
      icon: IconPackage,
      description: t('salesOptions.wholesaleProduct.description'),
    },
    {
      title: t('salesOptions.retailProduct.title'),
      url: `/${locale}/sales/retail-product`,
      icon: IconShoppingCart,
      description: t('salesOptions.retailProduct.description'),
    },
    {
      title: t('salesOptions.wholesaleMotorcycle.title'),
      url: `/${locale}/sales/wholesale-motorcycle`,
      icon: IconMotorbike,
      description: t('salesOptions.wholesaleMotorcycle.description'),
    },
    {
      title: t('salesOptions.retailMotorcycle.title'),
      url: `/${locale}/sales/retail-motorcycle`,
      icon: IconTrendingUp,
      description: t('salesOptions.retailMotorcycle.description'),
    },
  ]

  return (
    <div className={cn("flex flex-col gap-6", fontClass)} dir={direction}>
      {/* Sales Applications */}
      <div className={cn("grid grid-cols-1 gap-6 sm:grid-cols-2 px-4 lg:px-6", fontClass)}>
        {salesOptions.map((option) => {
          const isWholesale = option.title.toLowerCase().includes('wholesale')
          const isMotorcycle = option.title.toLowerCase().includes('motorcycle')
          return (
            <Link key={option.url} href={option.url}>
              <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <SalesIcon isWholesale={isWholesale} isMotorcycle={isMotorcycle} />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-base">{option.title}</CardTitle>
                      {option.description && (
                        <CardDescription className="text-xs mt-1">
                          {option.description}
                        </CardDescription>
                      )}
                    </div>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          )
        })}
      </div>

      {/* Statistics */}
      <SalesStatistics locale={locale} />

      {/* Activities Table */}
      <SalesActivitiesTable locale={locale} />
    </div>
  )
}

