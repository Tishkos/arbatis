'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { IconSearch, IconPackage, IconBike, IconFileInvoice, IconUsers, IconX } from '@tabler/icons-react'
import { Input } from '@/components/ui/input'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { cn } from '@/lib/utils'
import { getTextDirection } from '@/lib/i18n'

type SearchResult = {
  id: string
  name?: string
  sku?: string
  invoiceNumber?: string
  type: 'product' | 'motorcycle' | 'invoice' | 'customer'
  image?: string | null
  stockQuantity?: number
  mufradPrice?: any
  jumlaPrice?: any
  usdRetailPrice?: any
  usdWholesalePrice?: any
  total?: any
  status?: string
  invoiceDate?: Date
  customer?: { id: string; name: string; sku: string }
  phone?: string
  email?: string
  city?: string
  currentBalance?: any
}

type SearchResults = {
  products: SearchResult[]
  motorcycles: SearchResult[]
  invoices: SearchResult[]
  customers: SearchResult[]
  total: number
}

export function GlobalSearch() {
  const router = useRouter()
  const params = useParams()
  const locale = (params?.locale as string) || 'en'
  const t = useTranslations('search')
  const tNav = useTranslations('navigation')
  const fontClass = locale === 'ku' ? 'font-kurdish' : 'font-engar'
  const direction = getTextDirection(locale as 'ku' | 'en' | 'ar')
  const isRTL = direction === 'rtl'

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResults>({
    products: [],
    motorcycles: [],
    invoices: [],
    customers: [],
    total: 0,
  })
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const debounceTimer = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Debounced search
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }

    if (query.length < 2) {
      setResults({
        products: [],
        motorcycles: [],
        invoices: [],
        customers: [],
        total: 0,
      })
      setLoading(false)
      return
    }

    setLoading(true)
    debounceTimer.current = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=5`)
        if (response.ok) {
          const data = await response.json()
          console.log('Search results:', data)
          setResults(data)
        } else {
          // Handle non-OK responses
          const errorData = await response.json().catch(() => ({ error: 'Failed to fetch search results' }))
          console.error('Search API error:', errorData)
          setResults({
            products: [],
            motorcycles: [],
            invoices: [],
            customers: [],
            total: 0,
          })
        }
      } catch (error) {
        console.error('Search error:', error)
        setResults({
          products: [],
          motorcycles: [],
          invoices: [],
          customers: [],
          total: 0,
        })
      } finally {
        setLoading(false)
      }
    }, 300) // 300ms debounce

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }
    }
  }, [query])

  const handleSelect = (result: SearchResult) => {
    setOpen(false)
    setQuery('')
    
    switch (result.type) {
      case 'product':
        router.push(`/${locale}/products/${result.id}`)
        break
      case 'motorcycle':
        router.push(`/${locale}/motorcycles/${result.id}`)
        break
      case 'invoice':
        router.push(`/${locale}/invoices/${result.id}`)
        break
      case 'customer':
        router.push(`/${locale}/customers/${result.id}`)
        break
    }
  }

  const formatPrice = (price: any, currency: string = 'IQD') => {
    if (!price) return ''
    const num = typeof price === 'string' ? parseFloat(price) : Number(price)
    if (currency === 'USD') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(num)
    }
    return `${num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ع.د`
  }

  return (
    <>
      {/* Search Trigger Button */}
      <div className="relative hidden md:flex">
        <IconSearch className={cn(
          "absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground",
          isRTL ? "right-3" : "left-3"
        )} />
        <Input
          type="search"
          placeholder={t('placeholder')}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            if (!open && e.target.value.length >= 2) {
              setOpen(true)
            }
          }}
          onFocus={() => {
            if (query.length >= 2) {
              setOpen(true)
            }
          }}
          className={cn(
            "w-64",
            isRTL ? "pr-9" : "pl-9",
            fontClass
          )}
        />
        {query && (
          <button
            onClick={() => {
              setQuery('')
              setOpen(false)
            }}
            className={cn(
              "absolute top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground",
              isRTL ? "left-3" : "right-3"
            )}
          >
            <IconX className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Search Dialog */}
      {mounted && (
        <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder={t('placeholder')}
          value={query}
          onValueChange={setQuery}
          className={fontClass}
        />
        <CommandList>
          {loading && (
            <div className={cn("flex items-center justify-center py-12 px-6", fontClass)}>
              <div className="text-center space-y-2">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="text-sm text-muted-foreground">{t('searching')}</p>
              </div>
            </div>
          )}
          {!loading && results.total === 0 && query.length >= 2 && (
            <CommandEmpty className={cn("flex items-center justify-center py-12 px-6", fontClass)}>
              <div className="text-center space-y-2">
                <IconSearch className="h-10 w-10 mx-auto text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">{t('noResults')}</p>
              </div>
            </CommandEmpty>
          )}
          {!loading && query.length < 2 && (
            <CommandEmpty className={cn("flex items-center justify-center py-12 px-6", fontClass)}>
              <div className="text-center space-y-2">
                <IconSearch className="h-12 w-12 mx-auto text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">{t('startTyping')}</p>
              </div>
            </CommandEmpty>
          )}

          {!loading && results.products.length > 0 && (
            <CommandGroup heading={tNav('products')}>
              {results.products.map((product) => (
                <CommandItem
                  key={product.id}
                  value={product.id}
                  onSelect={() => handleSelect(product)}
                  className={cn("cursor-pointer", fontClass)}
                >
                  <IconPackage className="h-4 w-4 mr-2 text-blue-600" />
                  <div className="flex-1 min-w-0">
                    <div className={cn("text-sm font-medium truncate", fontClass)}>
                      {product.name}
                    </div>
                    <div className={cn("text-xs text-muted-foreground", fontClass)}>
                      {t('sku')}: {product.sku} • {t('stock')}: {product.stockQuantity}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {!loading && results.motorcycles.length > 0 && (
            <CommandGroup heading={tNav('motorcycle')}>
              {results.motorcycles.map((motorcycle) => (
                <CommandItem
                  key={motorcycle.id}
                  value={motorcycle.id}
                  onSelect={() => handleSelect(motorcycle)}
                  className={cn("cursor-pointer", fontClass)}
                >
                  <IconBike className="h-4 w-4 mr-2 text-green-600" />
                  <div className="flex-1 min-w-0">
                    <div className={cn("text-sm font-medium truncate", fontClass)}>
                      {motorcycle.name}
                    </div>
                    <div className={cn("text-xs text-muted-foreground", fontClass)}>
                      {t('sku')}: {motorcycle.sku} • {t('stock')}: {motorcycle.stockQuantity}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {!loading && results.invoices.length > 0 && (
            <CommandGroup heading={tNav('invoices')}>
              {results.invoices.map((invoice) => (
                <CommandItem
                  key={invoice.id}
                  value={`${invoice.invoiceNumber}-${invoice.id}`}
                  onSelect={() => handleSelect(invoice)}
                  className={cn("cursor-pointer hover:bg-accent transition-colors", fontClass)}
                >
                  <IconFileInvoice className="h-5 w-5 mr-3 text-purple-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className={cn("text-sm font-semibold truncate font-mono", fontClass)}>
                      {invoice.invoiceNumber}
                    </div>
                    <div className={cn("text-xs text-muted-foreground mt-1", fontClass)}>
                      {invoice.customer?.name || 'Unknown'} • {formatPrice(invoice.total)}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {!loading && results.customers.length > 0 && (
            <CommandGroup heading={tNav('customers')}>
              {results.customers.map((customer) => (
                <CommandItem
                  key={customer.id}
                  value={customer.id}
                  onSelect={() => handleSelect(customer)}
                  className={cn("cursor-pointer", fontClass)}
                >
                  <IconUsers className="h-4 w-4 mr-2 text-orange-600" />
                  <div className="flex-1 min-w-0">
                    <div className={cn("text-sm font-medium truncate", fontClass)}>
                      {customer.name}
                    </div>
                    <div className={cn("text-xs text-muted-foreground", fontClass)}>
                      {customer.phone && `${customer.phone} • `}
                      {t('sku')}: {customer.sku}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
      )}
    </>
  )
}

