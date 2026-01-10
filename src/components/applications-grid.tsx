"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import { useTranslations } from 'next-intl'
import Link from "next/link"
import {
  IconDashboard,
  IconPackage,
  IconMotorbike,
  IconShoppingCart,
  IconFileInvoice,
  IconUsers,
  IconUser,
  IconActivity,
} from "@tabler/icons-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { getTextDirection } from "@/lib/i18n"

type AppItem = {
  title: string
  url: string
  icon: React.ComponentType<{ className?: string }>
  description?: string
}

export function ApplicationsGrid() {
  const params = useParams()
  const locale = (params?.locale as string) || 'ku'
  const t = useTranslations('navigation')
  
  // Get font class based on locale
  const fontClass = locale === 'ku' ? 'font-kurdish' : 'font-engar'
  const direction = getTextDirection(locale as 'ku' | 'en' | 'ar')

  const applications: AppItem[] = [
    {
      title: t('dashboard'),
      url: `/${locale}/dashboard`,
      icon: IconDashboard,
      description: t('dashboardDescription'),
    },
    {
      title: t('products'),
      url: `/${locale}/products`,
      icon: IconPackage,
      description: t('productsDescription'),
    },
    {
      title: t('motorcycle'),
      url: `/${locale}/motorcycles`,
      icon: IconMotorbike,
      description: t('motorcycleDescription'),
    },
    {
      title: t('sales'),
      url: `/${locale}/sales`,
      icon: IconShoppingCart,
      description: t('salesDescription'),
    },
    {
      title: t('invoices'),
      url: `/${locale}/invoices`,
      icon: IconFileInvoice,
      description: t('invoicesDescription'),
    },
    {
      title: t('customers'),
      url: `/${locale}/customers`,
      icon: IconUsers,
      description: t('customersDescription'),
    },
    {
      title: t('employees'),
      url: `/${locale}/employees`,
      icon: IconUser,
      description: t('employeesDescription'),
    },
    {
      title: t('activities'),
      url: `/${locale}/activities`,
      icon: IconActivity,
      description: t('activitiesDescription'),
    },
  ]

  return (
    <div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 px-4 lg:px-6", fontClass)} dir={direction}>
      {applications.map((app) => {
        const Icon = app.icon
        return (
          <Link key={app.url} href={app.url}>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-base">{app.title}</CardTitle>
                    {app.description && (
                      <CardDescription className="text-xs mt-1">
                        {app.description}
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
  )
}

