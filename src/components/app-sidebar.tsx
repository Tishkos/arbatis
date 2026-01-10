"use client"

import * as React from "react"
import { useSession } from "next-auth/react"
import { useParams } from "next/navigation"
import { useTranslations } from 'next-intl'
import { getTextDirection } from '@/lib/i18n'
import {
  IconDashboard,
  IconPackage,
  IconMotorbike,
  IconShoppingCart,
  IconFileInvoice,
  IconUsers,
  IconUser,
  IconActivity,
  IconHelp,
  IconSettings,
} from "@tabler/icons-react"

import Link from "next/link"
import { NavMain } from '@/components/nav-main'
import { NavSecondary } from '@/components/nav-secondary'
import { NavUser } from '@/components/nav-user'
import { HelpDialog } from '@/components/help-dialog'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { data: session } = useSession()
  const params = useParams()
  const locale = (params?.locale as string) || 'ku'
  const t = useTranslations('navigation')
  const [isHelpDialogOpen, setIsHelpDialogOpen] = React.useState(false)
  
  // Determine sidebar side based on text direction (RTL = right, LTR = left)
  const direction = getTextDirection(locale as 'ku' | 'en' | 'ar')
  const sidebarSide = direction === 'rtl' ? 'right' : 'left'

  // Get user info from session or use defaults
  const user = {
    name: (session?.user as any)?.name || session?.user?.email?.split('@')[0] || 'User',
    email: session?.user?.email || '',
    avatar: (session?.user as any)?.image || null,
  }

  // Check if user is admin (admin@arb-groups.com or has ADMIN role)
  const isAdmin = session?.user?.email === 'admin@arb-groups.com' || 
                  (session?.user as any)?.role === 'ADMIN' ||
                  (session?.user as any)?.role === 'DEVELOPER'

  // Navigation sections with labels
  const navMainSections = [
    {
      items: [
        {
          title: t('dashboard'),
          url: `/${locale}/dashboard`,
          icon: IconDashboard,
        },
      ],
      separator: false,
    },
    {
      label: t('items'),
      items: [
        {
          title: t('products'),
          url: `/${locale}/products`,
          icon: IconPackage,
        },
        {
          title: t('motorcycle'),
          url: `/${locale}/motorcycles`,
          icon: IconMotorbike,
        },
      ],
      separator: false,
    },
    {
      label: t('sales'),
      items: [
        {
          title: t('sales'),
          url: `/${locale}/sales`,
          icon: IconShoppingCart,
        },
        {
          title: t('invoices'),
          url: `/${locale}/invoices`,
          icon: IconFileInvoice,
        },
      ],
      separator: false,
    },
    {
      label: t('people'),
      items: [
        {
          title: t('customers'),
          url: `/${locale}/customers`,
          icon: IconUsers,
        },
      ],
      separator: false,
    },
    {
      label: t('management'),
      items: [
        ...(isAdmin ? [
          {
            title: t('employees'),
            url: `/${locale}/employees`,
            icon: IconUser,
          },
        ] : []),
        {
          title: t('activities'),
          url: `/${locale}/activities`,
          icon: IconActivity,
        },
      ],
      separator: false,
    },
  ]

  const navSecondary = [
    {
      title: t('settings'),
      url: `/${locale}/settings`,
      icon: IconSettings,
    },
    {
      title: t('help'),
      url: `/${locale}/help`,
      icon: IconHelp,
      onClick: () => setIsHelpDialogOpen(true),
    },
   
  ]

  return (
    <Sidebar collapsible="offcanvas" side={sidebarSide} {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <Link href={`/${locale}/dashboard`} className="flex items-center gap-2">
                <img 
                  src="/assets/logo/arbati.png" 
                  alt="Arbati" 
                  className="h-8 w-auto dark:brightness-0 dark:invert"
                />
                <span className="text-base font-semibold">Arbati</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain sections={navMainSections} />
        <NavSecondary items={navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      
      <HelpDialog open={isHelpDialogOpen} onOpenChange={setIsHelpDialogOpen} />
    </Sidebar>
  )
}
