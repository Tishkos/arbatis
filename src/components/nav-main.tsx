"use client"

import * as React from "react"
import { IconCirclePlusFilled, IconMail, type Icon } from "@tabler/icons-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTranslations } from 'next-intl'

import { Button } from '@/components/ui/button'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from '@/components/ui/sidebar'
import { cn } from "@/lib/utils"

type NavItem = {
  title: string
  url: string
  icon?: Icon
}

type NavSection = {
  label?: string
  items: NavItem[]
  separator?: boolean
}

export function NavMain({
  sections,
}: {
  sections: NavSection[]
}) {
  const pathname = usePathname()

  return (
    <>
      {sections.map((section, sectionIndex) => (
        <React.Fragment key={sectionIndex}>
          <SidebarGroup className="group-data-[collapsible=icon]:hidden px-2 py-0.5">
            {section.label && <SidebarGroupLabel>{section.label}</SidebarGroupLabel>}
            <SidebarGroupContent className="gap-1">
              <SidebarMenu>
                {section.items.map((item) => {
                  const isActive = pathname === item.url || pathname?.startsWith(item.url + '/')
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton 
                        tooltip={item.title} 
                        asChild
                        isActive={isActive}
                        className={cn(
                          isActive &&
                            "!bg-black !text-white hover:!bg-black/90 [&_svg]:!text-white data-[active=true]:!bg-black data-[active=true]:!text-white"
                        )}>
                        <Link href={item.url}>
                          {item.icon && <item.icon />}
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          {section.separator && <SidebarSeparator />}
        </React.Fragment>
      ))}
    </>
  )
}
