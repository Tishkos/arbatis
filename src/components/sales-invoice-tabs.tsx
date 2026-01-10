"use client"

import * as React from "react"
import { useSession } from "next-auth/react"
import { useTranslations } from "next-intl"
import { getTextDirection } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { IconPlus, IconX, IconSearch, IconBell, IconHelp, IconUser } from "@tabler/icons-react"
import { SalesInvoiceForm } from "./sales-invoice-form"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"

export interface InvoiceTab {
  id: string
  title: string
  saleType: "wholesale-product" | "retail-product" | "wholesale-motorcycle" | "retail-motorcycle"
  draftId?: string | null
  customerName?: string | null
}

export interface SalesInvoiceTabsProps {
  locale: string
  saleType: "wholesale-product" | "retail-product" | "wholesale-motorcycle" | "retail-motorcycle"
  title: string
}

export function SalesInvoiceTabs({ locale, saleType, title }: SalesInvoiceTabsProps) {
  const { data: session } = useSession()
  const t = useTranslations('navigation.salesOptions')
  const fontClass = locale === 'ku' ? 'font-kurdish' : 'font-engar'
  const direction = getTextDirection(locale as 'ku' | 'en' | 'ar')
  const [tabs, setTabs] = React.useState<InvoiceTab[]>([])
  const [activeTabId, setActiveTabId] = React.useState<string | null>(null)
  const [commandOpen, setCommandOpen] = React.useState(false)

  // Storage key for tabs state
  const storageKey = `sales-invoice-tabs-${saleType}`

  // Get tab title based on sale type or customer name
  const getTabTitle = (type: string, index: number, draftId?: string | null, customerName?: string | null) => {
    // If customer name is provided, use it as the tab title
    if (customerName && customerName.trim()) {
      return customerName.trim()
    }
    
    // Otherwise, use the default naming with translations
    const titles: Record<string, string> = {
      "wholesale-product": t('wholesaleProduct.title'),
      "retail-product": t('retailProduct.title'),
      "wholesale-motorcycle": t('wholesaleMotorcycle.title'),
      "retail-motorcycle": t('retailMotorcycle.title'),
    }
    const baseTitle = titles[type] || t('salesInvoice')
    if (index === 0 && !draftId) {
      return t('newSalesInvoice')
    }
    return `${baseTitle} ${index > 0 ? index + 1 : ""}`
  }

  // Create new tab
  const createNewTab = () => {
    const newTab: InvoiceTab = {
      id: `tab-${Date.now()}`,
      title: getTabTitle(saleType, tabs.length),
      saleType,
      customerName: null,
    }
    setTabs([...tabs, newTab])
    setActiveTabId(newTab.id)
  }


  // Close tab
  const closeTab = (tabId: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    const newTabs = tabs.filter(tab => tab.id !== tabId)
    setTabs(newTabs)
    
    if (activeTabId === tabId) {
      if (newTabs.length > 0) {
        setActiveTabId(newTabs[newTabs.length - 1].id)
      } else {
        setActiveTabId(null)
      }
    }
  }

  // Update tab draft ID
  const updateTabDraftId = (tabId: string, draftId: string | null) => {
    setTabs(tabs.map(tab => {
      if (tab.id === tabId) {
        const newTitle = getTabTitle(tab.saleType, tabs.indexOf(tab), draftId, tab.customerName)
        return { ...tab, draftId, title: newTitle }
      }
      return tab
    }))
  }

  // Update tab customer name and title
  const updateTabCustomerName = (tabId: string, customerName: string | null) => {
    setTabs(tabs.map(tab => {
      if (tab.id === tabId) {
        const newTitle = getTabTitle(tab.saleType, tabs.indexOf(tab), tab.draftId, customerName)
        return { ...tab, customerName, title: newTitle }
      }
      return tab
    }))
  }

  // Save tabs state to localStorage (only after initial restore)
  React.useEffect(() => {
    // Don't save until we've restored (or determined there's nothing to restore)
    if (!hasRestoredTabsRef.current) {
      return
    }
    
    try {
      const tabsState = {
        tabs,
        activeTabId,
        saleType,
      }
      localStorage.setItem(storageKey, JSON.stringify(tabsState))
      console.log('Saved tabs state:', { tabsCount: tabs.length, activeTabId, saleType })
    } catch (error) {
      console.error('Error saving tabs state to localStorage:', error)
    }
  }, [tabs, activeTabId, saleType, storageKey])

  // Save tabs on beforeunload to ensure nothing is lost
  React.useEffect(() => {
    const handleBeforeUnload = () => {
      try {
        const tabsState = {
          tabs,
          activeTabId,
          saleType,
        }
        localStorage.setItem(storageKey, JSON.stringify(tabsState))
      } catch (error) {
        console.error('Error saving tabs state on unload:', error)
      }
    }
    
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [tabs, activeTabId, saleType, storageKey])

  // Restore tabs state from localStorage on mount
  const hasRestoredTabsRef = React.useRef(false)
  React.useEffect(() => {
    // Only restore once on mount
    if (hasRestoredTabsRef.current) return
    
    try {
      const savedState = localStorage.getItem(storageKey)
      if (savedState) {
        const tabsState = JSON.parse(savedState)
        if (tabsState.tabs && Array.isArray(tabsState.tabs) && tabsState.tabs.length > 0) {
          // Only restore if saleType matches (tabs are specific to sale type)
          if (tabsState.saleType === saleType) {
            // Regenerate titles for restored tabs to ensure they use customer names
            const restoredTabs = tabsState.tabs.map((tab: InvoiceTab, index: number) => ({
              ...tab,
              title: getTabTitle(tab.saleType, index, tab.draftId, tab.customerName)
            }))
            setTabs(restoredTabs)
            // Restore active tab if it exists, otherwise use first tab
            if (tabsState.activeTabId && restoredTabs.find((t: InvoiceTab) => t.id === tabsState.activeTabId)) {
              setActiveTabId(tabsState.activeTabId)
            } else if (restoredTabs.length > 0) {
              setActiveTabId(restoredTabs[0].id)
            }
            console.log('Restored tabs state:', { tabsCount: restoredTabs.length, activeTabId: tabsState.activeTabId, saleType })
            hasRestoredTabsRef.current = true
            return // Don't create new tab if we restored
          }
        }
      }
    } catch (error) {
      console.error('Error restoring tabs state from localStorage:', error)
    }
    
    // Only auto-create first tab if no tabs were restored
    if (!hasRestoredTabsRef.current) {
      hasRestoredTabsRef.current = true
      createNewTab()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run on mount

  // Keyboard shortcut for command palette (Ctrl+G)
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "g" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setCommandOpen((open) => !open)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  const activeTab = tabs.find(tab => tab.id === activeTabId)

  return (
    <div className={cn("flex h-full flex-col", fontClass)} dir={direction}>
      {/* Top Header Bar */}
      <div className="flex-shrink-0 border-b bg-background">
        <div className="flex items-center justify-end px-4 py-3">
          {/* New Sales Invoice Button */}
            <Button 
              variant="outline"
              size="sm"
              className="bg-black text-white hover:bg-black/90 hover:text-white"
              onClick={createNewTab}
            >
              <IconPlus className="h-4 w-4 mr-2" />
              {t('newSalesInvoice')}
            </Button>
        </div>
      </div>

      {/* Chrome-style Tab Bar */}
      <div className="flex-shrink-0 border-b bg-muted/30">
        <div className="flex items-center gap-1 overflow-x-auto px-2 py-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={cn(
                "group relative flex items-center gap-2 rounded-t-lg border-b-2 px-4 py-2 transition-colors cursor-pointer min-w-[120px] max-w-[240px] flex-shrink-0",
                activeTabId === tab.id
                  ? "border-primary bg-background text-foreground shadow-sm z-10"
                  : "border-transparent bg-muted/50 text-muted-foreground hover:bg-muted"
              )}
            >
              <span className="truncate text-sm font-medium flex-1">
                {tab.title}
              </span>
              <button
                onClick={(e) => closeTab(tab.id, e)}
                className={cn(
                  "opacity-0 group-hover:opacity-100 rounded-sm p-0.5 transition-opacity hover:bg-destructive/10 flex-shrink-0",
                  activeTabId === tab.id && "opacity-100"
                )}
              >
                <IconX className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          
          {/* New Tab Button (Chrome style) */}
          <button
            onClick={createNewTab}
            className="flex items-center justify-center rounded-t-lg border border-dashed border-muted-foreground/30 px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors flex-shrink-0"
            title={t('newTab')}
          >
            <IconPlus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab ? (
          <SalesInvoiceForm
            key={activeTab.id}
            tabId={activeTab.id}
            saleType={activeTab.saleType}
            locale={locale}
            onDraftIdChange={(draftId) => updateTabDraftId(activeTab.id, draftId)}
            onCustomerNameChange={(customerName) => updateTabCustomerName(activeTab.id, customerName)}
            onSubmitSuccess={() => closeTab(activeTab.id)}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-muted-foreground mb-4">No invoice tabs open</p>
              <Button onClick={createNewTab}>
                <IconPlus className="h-4 w-4 mr-2" />
                {t('createNewInvoice')}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Command Palette */}
      <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
        <CommandInput placeholder="Search or type a command (Ctrl + G)" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Actions">
            <CommandItem onSelect={() => { createNewTab(); setCommandOpen(false); }}>
              <IconPlus className="h-4 w-4 mr-2" />
              {t('newSalesInvoice')}
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  )
}

