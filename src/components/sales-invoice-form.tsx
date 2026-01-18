"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { getTextDirection } from "@/lib/i18n"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { IconPlus, IconX, IconCheck, IconChevronDown, IconFileText, IconAlertTriangle, IconCircleCheck, IconArrowLeft } from "@tabler/icons-react"
import { debounce } from "@/lib/utils"
import { ProductDialog } from "@/components/product-dialog"
import { MotorcycleDialog } from "@/components/motorcycle-dialog"
import { InvoiceSuccessDialog } from "@/components/invoice-success-dialog"
import { useToast } from '@/components/ui/use-toast'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogAction,
} from '@/components/ui/alert-dialog-animated'

export interface SalesInvoiceFormProps {
  tabId: string
  saleType: "wholesale-product" | "retail-product" | "wholesale-motorcycle" | "retail-motorcycle"
  locale: string
  invoiceId?: string // Optional invoice ID for editing existing invoice
  onDraftIdChange?: (draftId: string | null) => void
  onCustomerNameChange?: (customerName: string | null) => void
  onSubmitSuccess?: () => void // Callback when invoice is successfully submitted
}

// Form state interface for localStorage persistence
interface FormState {
  draftId: string | null
  draftStatus: 'CREATED' | 'READY' | 'FINALIZING' | 'FINALIZED' | null
  namingSeries: string
  customerId: string
  customerName: string
  selectedCustomer: Customer | null
  fetchCustomer: boolean
  date: string
  postingDate: string
  postingTime: string
  dueDate: string
  currency: 'IQD' | 'USD'
  isReturn: boolean
  isPos: boolean
  updateStock: boolean
  items: InvoiceItem[]
  discountEnabled: boolean
  discountType: "percentage" | "value"
  discountAmount: number
  totalAdvance: number
  amountPaid: number
  customerCurrentDebt: number
  customerCurrentBalance: number
}

export interface InvoiceItem {
  id: string
  itemId: string | null
  itemName: string
  itemType: "product" | "motorcycle"
  quantity: number
  rate: number
  amount: number
  stockQuantity?: number // Available stock quantity for validation
  isProductInDatabase?: boolean // Track if product exists in database
  productNotFound?: boolean // Track if product search was done and not found
  originalPrice?: number // Original price from product/motorcycle for price comparison
}

export interface Customer {
  id: string
  name: string
  sku: string
  phone?: string
  email?: string
  debtIqd?: number | string
  debtUsd?: number | string
  currentBalance?: number | string
}

export interface Product {
  id: string
  name: string
  sku: string
  mufradPrice: number
  jumlaPrice: number
  stockQuantity: number
}

export interface Motorcycle {
  id: string
  name?: string // New schema uses name
  brand?: string // Old schema fallback
  model?: string // Old schema fallback
  sku: string
  usdRetailPrice: number
  usdWholesalePrice: number
  stockQuantity: number
}

export function SalesInvoiceForm({ tabId, saleType, locale, invoiceId, onDraftIdChange, onCustomerNameChange, onSubmitSuccess }: SalesInvoiceFormProps) {
  const params = useParams()
  const t = useTranslations('navigation.salesOptions')
  const fontClass = locale === 'ku' ? 'font-kurdish' : 'font-engar'
  const direction = getTextDirection(locale as 'ku' | 'en' | 'ar')
  const { toast } = useToast()
  
  const isWholesale = saleType.includes('wholesale')
  const isProduct = saleType.includes('product')
  const isMotorcycle = saleType.includes('motorcycle')
  const isRetail = saleType.includes('retail')
  
  // Get display name for current application type
  const getApplicationType = () => {
    // When editing, use the actual invoice type detected from items
    // Otherwise, use the saleType prop
    const isMotorcycleInvoice = invoiceId 
      ? (actualInvoiceIsMotorcycle ?? isMotorcycle) 
      : isMotorcycle
    const isProductInvoice = invoiceId 
      ? (actualInvoiceIsMotorcycle === false ? true : (actualInvoiceIsMotorcycle === null ? isProduct : false))
      : isProduct
    
    if (isWholesale && isProductInvoice) return t('wholesaleProduct.title')
    if (isWholesale && isMotorcycleInvoice) return t('wholesaleMotorcycle.title')
    if (isRetail && isProductInvoice) return t('retailProduct.title')
    if (isRetail && isMotorcycleInvoice) return t('retailMotorcycle.title')
    return t('salesInvoice')
  }

  // State
  const [draftId, setDraftId] = React.useState<string | null>(null)
  const [draftStatus, setDraftStatus] = React.useState<'CREATED' | 'READY' | 'FINALIZING' | 'FINALIZED' | null>(null)
  const [isSaving, setIsSaving] = React.useState(false)
  const [isSaved, setIsSaved] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [showSubmitConfirm, setShowSubmitConfirm] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState("details")
  
  // Alert dialog states
  const [alertDialog, setAlertDialog] = React.useState<{
    open: boolean
    type: 'error' | 'success' | 'info'
    title: string
    message: string
  }>({
    open: false,
    type: 'info',
    title: '',
    message: '',
  })
  
  // Details Tab
  // Generate random 6-digit numeric code (100000-999999)
  const generateRandomId = () => {
    const min = 100000
    const max = 999999
    const code = Math.floor(Math.random() * (max - min + 1)) + min
    return code.toString()
  }
  
  // Generate series based on customerName-date-generatedCode
  // Format: customerName-YYYY-MM-DD-RANDOMCODE
  const generateSeries = (customerName: string) => {
    if (!customerName) {
      return ""
    }
    const now = new Date()
    const dateStr = format(now, 'yyyy-MM-dd')
    const randomCode = generateRandomId()
    return `${customerName}-${dateStr}-${randomCode}`
  }
  
  const [namingSeries, setNamingSeries] = React.useState("")
  const [customerId, setCustomerId] = React.useState<string>("")
  const [customerName, setCustomerName] = React.useState<string>("") // For retail: can be any name
  const [customerSearch, setCustomerSearch] = React.useState("")
  const [customerOpen, setCustomerOpen] = React.useState(false)
  const [customers, setCustomers] = React.useState<Customer[]>([])
  const [selectedCustomer, setSelectedCustomer] = React.useState<Customer | null>(null)
  // For retail: option to fetch customer from database or enter as free text
  // For wholesale: MUST fetch from database (always true)
  const [fetchCustomer, setFetchCustomer] = React.useState<boolean>(!isRetail) // Default: true for wholesale (mandatory), false for retail (optional)
  const [date, setDate] = React.useState(format(new Date(), 'yyyy-MM-dd'))
  const [postingTime, setPostingTime] = React.useState(format(new Date(), 'HH:mm:ss'))
  const [postingDate, setPostingDate] = React.useState(format(new Date(), 'yyyy-MM-dd'))
  const [dueDate, setDueDate] = React.useState("")
  // Currency: Motorcycles = USD, Products = IQD (automatically set based on saleType)
  const [currency, setCurrency] = React.useState<'IQD' | 'USD'>(isMotorcycle ? 'USD' : 'IQD')
  const [isPos, setIsPos] = React.useState(false)
  
  // Update currency when saleType changes
  React.useEffect(() => {
    setCurrency(isMotorcycle ? 'USD' : 'IQD')
  }, [isMotorcycle])

  // For wholesale: always require fetchCustomer to be true (mandatory database selection)
  React.useEffect(() => {
    if (isWholesale && !fetchCustomer) {
      setFetchCustomer(true)
    }
  }, [isWholesale, fetchCustomer])
  const [isReturn, setIsReturn] = React.useState(false)
  const [isDebitNote, setIsDebitNote] = React.useState(false)
  const [updateStock, setUpdateStock] = React.useState(true)
  
  // Items
  const [items, setItems] = React.useState<InvoiceItem[]>([])
  const [itemOpen, setItemOpen] = React.useState<{ [key: string]: boolean }>({})
  const [itemProducts, setItemProducts] = React.useState<{ [key: string]: Product[] }>({})
  const [itemMotorcycles, setItemMotorcycles] = React.useState<{ [key: string]: Motorcycle[] }>({})
  
  // Product dialog state
  const [productDialogOpen, setProductDialogOpen] = React.useState(false)
  const [productDialogData, setProductDialogData] = React.useState<{ name: string; price: number; itemId: string } | null>(null)
  const [categories, setCategories] = React.useState<{ id: string; name: string }[]>([])
  
  // Category dropdown state (per item) - Products
  const [categoryViewState, setCategoryViewState] = React.useState<{ [key: string]: 'categories' | 'products' }>({})
  const [selectedCategoryProducts, setSelectedCategoryProducts] = React.useState<{ [key: string]: Product[] }>({})
  const [selectedCategoryId, setSelectedCategoryId] = React.useState<{ [key: string]: string | null }>({})
  const [categoryPopoverOpen, setCategoryPopoverOpen] = React.useState<{ [key: string]: boolean }>({})
  const [categoryProductSearch, setCategoryProductSearch] = React.useState<{ [key: string]: string }>({})
  
  // Category dropdown state (per item) - Motorcycles
  const [motorcycleCategoryViewState, setMotorcycleCategoryViewState] = React.useState<{ [key: string]: 'categories' | 'motorcycles' }>({})
  const [selectedCategoryMotorcycles, setSelectedCategoryMotorcycles] = React.useState<{ [key: string]: Motorcycle[] }>({})
  const [selectedMotorcycleCategoryId, setSelectedMotorcycleCategoryId] = React.useState<{ [key: string]: string | null }>({})
  const [motorcycleCategoryPopoverOpen, setMotorcycleCategoryPopoverOpen] = React.useState<{ [key: string]: boolean }>({})
  const [categoryMotorcycleSearch, setCategoryMotorcycleSearch] = React.useState<{ [key: string]: string }>({})
  
  // Motorcycle dialog state (for motorcycle invoice types)
  const [motorcycleDialogOpen, setMotorcycleDialogOpen] = React.useState(false)
  const [motorcycleDialogData, setMotorcycleDialogData] = React.useState<{ name: string; price: number; itemId: string } | null>(null)
  
  // Invoice success dialog state
  const [invoiceSuccessDialog, setInvoiceSuccessDialog] = React.useState<{
    open: boolean
    invoiceNumber: string
    invoiceId?: string
  }>({
    open: false,
    invoiceNumber: '',
  })
  
  // Fetch categories for product dialog (convert to callback for reuse)
  const fetchCategories = React.useCallback(async () => {
    try {
      const response = await fetch('/api/categories')
      if (response.ok) {
        const data = await response.json()
        if (data.categories) {
          setCategories(data.categories)
        }
      }
    } catch (error) {
      console.error('Error fetching categories:', error)
    }
  }, [])

  React.useEffect(() => {
    fetchCategories()
  }, [fetchCategories])
  
  // Fetch motorcycle categories (separate from product categories)
  const [motorcycleCategories, setMotorcycleCategories] = React.useState<{ id: string; name: string }[]>([])
  const fetchMotorcycleCategories = React.useCallback(async () => {
    try {
      const response = await fetch('/api/motorcycle-categories')
      if (response.ok) {
        const data = await response.json()
        if (data.categories) {
          setMotorcycleCategories(data.categories)
        }
      }
    } catch (error) {
      console.error('Error fetching motorcycle categories:', error)
    }
  }, [])

  React.useEffect(() => {
    fetchMotorcycleCategories()
  }, [fetchMotorcycleCategories])
  
  // Taxes
  const [taxCategory, setTaxCategory] = React.useState("")
  const [taxesAndCharges, setTaxesAndCharges] = React.useState("")
  const [shippingRule, setShippingRule] = React.useState("")
  const [incoterm, setIncoterm] = React.useState("")
  
  // Discount
  const [discountEnabled, setDiscountEnabled] = React.useState(false)
  const [discountType, setDiscountType] = React.useState<'percentage' | 'value'>('percentage')
  const [discountAmount, setDiscountAmount] = React.useState(0)
  
  // Price-aware styling toggle
  const [priceAwareEnabled, setPriceAwareEnabled] = React.useState(false)
  
  // Totals
  const [totalQty, setTotalQty] = React.useState(0)
  const [total, setTotal] = React.useState(0)
  const [totalTaxes, setTotalTaxes] = React.useState(0)
  const [discountValue, setDiscountValue] = React.useState(0)
  const [grandTotal, setGrandTotal] = React.useState(0)
  const [roundingAdjustment, setRoundingAdjustment] = React.useState(0)
  const [roundedTotal, setRoundedTotal] = React.useState(0)
  const [totalAdvance, setTotalAdvance] = React.useState(0)
  const [outstandingAmount, setOutstandingAmount] = React.useState(0)
  
  // Customer balance/debt (for wholesale)
  const [customerCurrentDebt, setCustomerCurrentDebt] = React.useState(0)
  const [customerCurrentBalance, setCustomerCurrentBalance] = React.useState(0)
  
  // Store original invoice amountDue when editing (to correctly calculate balance)
  const [originalInvoiceAmountDue, setOriginalInvoiceAmountDue] = React.useState(0)
  
  // Store actual invoice type when editing (detected from items, not from saleType prop)
  const [actualInvoiceIsMotorcycle, setActualInvoiceIsMotorcycle] = React.useState<boolean | null>(null)

  // Notify parent of draft ID changes
  const onDraftIdChangeRef = React.useRef(onDraftIdChange)
  React.useEffect(() => {
    onDraftIdChangeRef.current = onDraftIdChange
  }, [onDraftIdChange])

  React.useEffect(() => {
    if (onDraftIdChangeRef.current) {
      onDraftIdChangeRef.current(draftId)
    }
  }, [draftId])

  // Generate series when customer name is available
  // BUT: Don't auto-generate when editing an invoice - preserve the original invoice number
  React.useEffect(() => {
    // Skip auto-generation if we're editing an invoice
    if (invoiceId) {
      return
    }
    
    const nameToUse = selectedCustomer?.name || customerName
    if (nameToUse) {
      const newSeries = generateSeries(nameToUse)
      setNamingSeries(newSeries)
    } else {
      setNamingSeries("")
    }
  }, [selectedCustomer, customerName, invoiceId])

  // Save form state to localStorage whenever it changes
  const saveFormState = React.useCallback(() => {
    const formState: FormState = {
      draftId,
      draftStatus,
      namingSeries,
      customerId,
      customerName,
      selectedCustomer,
      fetchCustomer,
      date,
      postingDate,
      postingTime,
      dueDate,
      currency,
      isReturn,
      isPos,
      updateStock,
      items,
      discountEnabled,
      discountType,
      discountAmount,
      totalAdvance,
      amountPaid: 0, // Will be calculated from customerCurrentDebt if needed
      customerCurrentDebt,
      customerCurrentBalance,
    }
    try {
      const serialized = JSON.stringify(formState)
      localStorage.setItem(`sales-invoice-form-${tabId}`, serialized)
      console.log('Saved form state for tab:', tabId, 'Items count:', items.length)
    } catch (error) {
      console.error('Error saving form state to localStorage:', error)
    }
  }, [tabId, draftId, draftStatus, namingSeries, customerId, customerName, selectedCustomer, fetchCustomer, date, postingDate, postingTime, dueDate, currency, isReturn, isPos, updateStock, items, discountEnabled, discountType, discountAmount, totalAdvance, customerCurrentDebt, customerCurrentBalance])

  // Force immediate save to localStorage (no debounce for data persistence)
  // This ensures data is never lost, even if user navigates away quickly
  // BUT: Don't save if we're currently restoring (would overwrite restored data)
  React.useEffect(() => {
    // Don't save if we're in the middle of restoring
    if (isRestoringRef.current) {
      console.log('Skipping save - currently restoring')
      return
    }
    
    // Don't save if we haven't restored yet (initial mount)
    // Wait a bit to let restore complete first
    if (!hasRestoredRef.current && tabId) {
      // Check if there's saved state - if yes, wait for restore
      const savedState = localStorage.getItem(`sales-invoice-form-${tabId}`)
      if (savedState) {
        console.log('Skipping save - waiting for restore to complete')
        // Wait a bit longer for restore to complete
        const timeoutId = setTimeout(() => {
          hasRestoredRef.current = true // Mark as restored after timeout
        }, 200)
        return () => clearTimeout(timeoutId)
      }
    }
    
    // Only save if we have actual data OR if we've already restored
    // This prevents saving empty state on initial mount
    const hasData = items.length > 0 || customerId || customerName || namingSeries
    if (!hasData && !hasRestoredRef.current) {
      console.log('Skipping save - no data and not restored yet')
      return
    }
    
    // Save immediately on any change (after restore is complete)
    saveFormState()
  }, [saveFormState, tabId, items.length, customerId, customerName, namingSeries, postingDate, postingTime, totalAdvance])
  
  // Also save on beforeunload and visibility change to ensure data is saved when navigating away
  React.useEffect(() => {
    const handleBeforeUnload = () => {
      // Force synchronous save before page unloads
      saveFormState()
    }
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Save when tab becomes hidden (user navigates away)
        saveFormState()
      }
    }
    
    const handlePageHide = () => {
      // Save when page is being hidden (navigation)
      saveFormState()
    }
    
    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('pagehide', handlePageHide)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('pagehide', handlePageHide)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [saveFormState])

  // Track if we've restored state to prevent overwriting with empty state
  const hasRestoredRef = React.useRef(false)
  const isRestoringRef = React.useRef(false)
  const restoreTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)
  const invoiceLoadedRef = React.useRef(false)
  
  // Load invoice data when invoiceId is provided (edit mode)
  React.useEffect(() => {
    if (!invoiceId || invoiceLoadedRef.current) return
    
    const loadInvoice = async () => {
      try {
        const response = await fetch(`/api/invoices/${invoiceId}`)
        if (!response.ok) {
          console.error('Failed to load invoice:', response.statusText)
          return
        }
        
        const data = await response.json()
        const invoice = data.invoice
        
        if (!invoice) {
          console.error('Invoice not found in response')
          return
        }
        
        console.log('Loading invoice:', invoice.id, 'Items count:', invoice.items?.length || 0)
        
        if (invoice) {
          // Set draft ID and status
          if (invoice.draft?.id) {
            setDraftId(invoice.draft.id)
            setDraftStatus(invoice.draft.status || 'FINALIZED')
          } else {
            setDraftStatus('FINALIZED')
          }
          
          // Set invoice number
          setNamingSeries(invoice.invoiceNumber || '')
          
          // Determine invoice type from actual invoice items (not from saleType prop)
          // Check if any item is a motorcycle by looking at notes or product name
          // This needs to be determined BEFORE processing items so it's available throughout
          const itemsToCheck = (invoice.items && invoice.items.length > 0) 
            ? invoice.items 
            : (invoice.sale?.items || [])
          
          // First, try to detect from items
          let invoiceHasMotorcycle = itemsToCheck.some((item: any) => {
            const notes = item.notes || ''
            const productName = item.product?.name || ''
            return notes.toUpperCase().trim().startsWith('MOTORCYCLE:') || 
                   productName.toLowerCase().includes('motorcycle')
          })
          
          // Fallback: check invoice currency field (set by API based on items)
          if (!invoiceHasMotorcycle && invoice.currency === 'USD') {
            invoiceHasMotorcycle = true
          } else if (invoiceHasMotorcycle === false && invoice.currency === 'IQD') {
            invoiceHasMotorcycle = false
          }
          
          // Store the actual invoice type for use in Payment Summary and display
          setActualInvoiceIsMotorcycle(invoiceHasMotorcycle)
          
          // Set customer
          if (invoice.customer) {
            setCustomerId(invoice.customer.id)
            setCustomerName(invoice.customer.name)
            setSelectedCustomer({
              id: invoice.customer.id,
              name: invoice.customer.name,
              sku: invoice.customer.sku,
              phone: invoice.customer.phone || undefined,
              email: invoice.customer.email || undefined,
              debtIqd: invoice.customer.debtIqd || 0,
              debtUsd: invoice.customer.debtUsd || 0,
              currentBalance: invoice.customer.currentBalance || 0,
            })
            setFetchCustomer(true)
            
            // Update currency based on detected invoice type
            if (invoiceHasMotorcycle) {
              setCurrency('USD')
            } else {
              setCurrency('IQD')
            }
            
            // Set customer debt based on actual invoice type (motorcycle = USD, product = IQD)
            if (invoiceHasMotorcycle) {
              // Motorcycle invoice - use USD debt
              setCustomerCurrentDebt(Number(invoice.customer.debtUsd || 0))
              setCustomerCurrentBalance(Number(invoice.customer.debtUsd || 0))
            } else {
              // Product invoice - use IQD debt
              setCustomerCurrentDebt(Number(invoice.customer.debtIqd || 0))
              setCustomerCurrentBalance(Number(invoice.customer.currentBalance || 0))
            }
          }
          
          // Set dates
          if (invoice.invoiceDate) {
            const invoiceDate = new Date(invoice.invoiceDate)
            setDate(format(invoiceDate, 'yyyy-MM-dd'))
            setPostingDate(format(invoiceDate, 'yyyy-MM-dd'))
            setPostingTime(format(invoiceDate, 'HH:mm:ss'))
          }
          if (invoice.dueDate) {
            setDueDate(format(new Date(invoice.dueDate), 'yyyy-MM-dd'))
          }
          
          // Set payment info
          setTotalAdvance(invoice.amountPaid || 0)
          
          // Store original amountDue for balance calculation in edit mode
          // This is needed because customerCurrentDebt already includes this invoice's amountDue
          setOriginalInvoiceAmountDue(Number(invoice.amountDue || 0))
          
          // Set discount
          if (invoice.discount > 0) {
            setDiscountEnabled(true)
            // Calculate if it's percentage or fixed amount (rough estimate)
            const discountPercent = (invoice.discount / invoice.subtotal) * 100
            if (discountPercent < 100) {
              setDiscountType('percentage')
              setDiscountAmount(discountPercent)
            } else {
              setDiscountType('value')
              setDiscountAmount(invoice.discount)
            }
          }
          
          // Set items - handle both products and motorcycles
          // IMPORTANT: When editing an invoice, we need to restore sold quantities to available stock
          // Example: If we had 25 items, sold all 25, now we have 0 in stock
          // But when editing, we should see 25 available (0 + 25 sold in this invoice)
          // Use invoice.items first, fallback to sale.items if invoice.items is empty
          const itemsToProcess = (invoice.items && invoice.items.length > 0) ? invoice.items : (invoice.sale?.items || [])
          
          if (itemsToProcess && itemsToProcess.length > 0) {
            console.log('Processing invoice items:', itemsToProcess.length, 'from', invoice.items?.length ? 'invoice.items' : 'sale.items')
            console.log('Items to process:', itemsToProcess.map((item: any, idx: number) => ({
              index: idx,
              productId: item.productId,
              hasProduct: !!item.product,
              productName: item.product?.name,
              notes: item.notes
            })))
            const invoiceItems: InvoiceItem[] = await Promise.all(
              itemsToProcess.map(async (item: any, index: number) => {
                // Check if it's a motorcycle item (notes contain MOTORCYCLE:)
                // Handle both uppercase and lowercase
                const itemNotes = item.notes || ''
                const isMotorcycleItem = itemNotes.toUpperCase().trim().startsWith('MOTORCYCLE:')
                
                // CRITICAL: Always preserve productId as itemId - this ensures items can be saved even if product is missing
                // Note: sale.items don't have productId field, only product relation, so use product?.id as fallback
                const originalProductId = item.productId || item.product?.id || null
                let itemName = item.product?.name || null
                let itemId = originalProductId // Always start with productId (or product.id if productId is missing)
                let stockQuantity = item.product?.stockQuantity || undefined
                const originalQuantitySold = item.quantity || 0
                
                console.log(`Item ${index}:`, {
                  productId: item.productId,
                  notes: item.notes,
                  isMotorcycle: isMotorcycleItem,
                  product: item.product,
                  hasProductRelation: !!item.product
                })
                
                // If it's a motorcycle, fetch motorcycle details
                if (isMotorcycleItem && !item.product) {
                  const motorcycleId = itemNotes.replace(/^MOTORCYCLE:/i, '').trim()
                  if (motorcycleId) {
                    try {
                      const motoResponse = await fetch(`/api/motorcycles/${motorcycleId}`)
                      if (motoResponse.ok) {
                        const motoData = await motoResponse.json()
                        const motorcycle = motoData.motorcycle
                        if (motorcycle) {
                          itemName = motorcycle.name || `${motorcycle.brand || ''} ${motorcycle.model || ''}`.trim()
                          itemId = motorcycleId
                          // Restore sold quantity: current stock + quantity sold in this invoice
                          stockQuantity = (motorcycle.stockQuantity || 0) + originalQuantitySold
                        }
                      } else {
                        console.warn('Failed to fetch motorcycle:', motorcycleId, motoResponse.statusText)
                        // Use motorcycle ID as fallback name if fetch fails
                        itemName = itemName || `Motorcycle ${motorcycleId.slice(0, 8)}`
                      }
                    } catch (error) {
                      console.error('Error fetching motorcycle:', error)
                      // Use motorcycle ID as fallback name if fetch fails
                      itemName = itemName || `Motorcycle ${motorcycleId.slice(0, 8)}`
                    }
                  }
                } else if (item.productId) {
                  // CRITICAL: If we have productId, ALWAYS preserve it as itemId
                  // This ensures items can be saved even if product relation is missing
                  itemId = item.productId
                  
                  if (item.product) {
                    // Product relation exists - use product data
                    itemName = item.product.name
                    stockQuantity = (item.product.stockQuantity || 0) + originalQuantitySold
                  } else {
                    // Product relation is missing but productId exists - try to fetch product
                    // This handles cases where product was deleted or relation wasn't loaded
                    try {
                      const productResponse = await fetch(`/api/products/${item.productId}`)
                      if (productResponse.ok) {
                        const productData = await productResponse.json()
                        if (productData.product) {
                          itemName = productData.product.name
                          stockQuantity = (productData.product.stockQuantity || 0) + originalQuantitySold
                        } else {
                          // Product not found - use productId as fallback
                          // itemId is already set above, so we just need to set the name
                          itemName = `Product ${item.productId.slice(0, 8)}`
                          console.warn(`Product ${item.productId} not found in database - preserving itemId for save`)
                        }
                      } else {
                        // Product fetch failed - use productId as fallback
                        // itemId is already set above, so we just need to set the name
                        itemName = `Product ${item.productId.slice(0, 8)}`
                        console.warn(`Failed to fetch product ${item.productId}:`, productResponse.statusText, '- preserving itemId for save')
                      }
                    } catch (error) {
                      console.error('Error fetching product by ID:', error)
                      // If product fetch fails, use productId as fallback name
                      // itemId is already set above, so we just need to set the name
                      itemName = itemName || `Product ${item.productId.slice(0, 8)}`
                      console.warn('Product fetch error - preserving itemId for save:', item.productId)
                    }
                  }
                }
                
                // Final fallback - if we still don't have a name, use a generic one
                // CRITICAL: Ensure itemId is ALWAYS preserved from productId
                // Since we set itemId = item.productId at the start of the else if block,
                // itemId should already be set. But add safety checks just in case.
                if (!itemId && originalProductId) {
                  itemId = originalProductId
                  console.warn(`Item ${index}: itemId was null but productId exists - preserving productId:`, originalProductId)
                }
                
                // CRITICAL: Final safety check - ensure itemId is ALWAYS set if we have productId
                if (!itemId && item.productId) {
                  itemId = item.productId
                  console.warn(`Item ${index}: Final fallback - using productId as itemId:`, item.productId)
                }
                
                if (!itemName) {
                  if (originalProductId) {
                    // Try one more time to get product name by fetching from API
                    // This is a final attempt before giving up
                    try {
                      const productResponse = await fetch(`/api/products/${originalProductId}`)
                      if (productResponse.ok) {
                        const productData = await productResponse.json()
                        if (productData.product?.name) {
                          itemName = productData.product.name
                          stockQuantity = (productData.product.stockQuantity || 0) + originalQuantitySold
                        } else {
                          // Product exists but no name - use productId-based fallback
                          itemName = `Product ${originalProductId.slice(0, 8)}`
                        }
                      } else {
                        // Product fetch failed - use productId-based fallback
                        itemName = `Product ${originalProductId.slice(0, 8)}`
                      }
                    } catch (error) {
                      // Fetch error - use productId-based fallback
                      itemName = `Product ${originalProductId.slice(0, 8)}`
                    }
                  } else {
                    // No productId at all - this shouldn't happen for products, but handle it
                    itemName = 'Unknown Item'
                  }
                }
                
                // FINAL ABSOLUTE CHECK: Ensure itemId is ALWAYS set if we have productId
                // This is the absolute last line of defense to prevent losing items
                if (!isMotorcycleItem && !itemId && originalProductId) {
                  itemId = originalProductId
                  console.error(`CRITICAL FALLBACK: Item ${index} still has no itemId - using originalProductId:`, originalProductId)
                }
                
                // Final safety check: if we still don't have itemId but we have originalProductId, use it
                // This ensures items are NEVER lost, even if all other logic fails
                if (!itemId && originalProductId) {
                  itemId = originalProductId
                  console.warn(`FINAL FALLBACK: Item ${index} using originalProductId as itemId:`, originalProductId)
                }
                
                // If we still don't have itemId for a product item, log a warning (not an error)
                // The item will still be saved, just without productId
                if (!isMotorcycleItem && !itemId) {
                  console.warn(`WARNING: Item ${index} (${itemName}) has no itemId and no productId - will save without productId`, {
                    item,
                    itemName,
                    originalProductId,
                    hasProduct: !!item.product,
                    productId: item.productId
                  })
                }
                
                return {
                  id: `item-${item.id || Date.now()}-${index}`,
                  itemId: itemId || null, // Ensure it's never undefined
                  itemName: itemName || 'Unknown Item',
                  itemType: isMotorcycleItem ? 'motorcycle' : 'product',
                  quantity: originalQuantitySold,
                  rate: Number(item.unitPrice) || 0,
                  amount: Number(item.lineTotal) || 0,
                  stockQuantity: stockQuantity, // This now includes the restored quantity
                  isProductInDatabase: !!itemId,
                  productNotFound: false,
                }
              })
            )
            console.log('Loaded invoice items:', invoiceItems.length)
            console.log('Loaded invoice items with itemIds:', invoiceItems.map((item, idx) => ({
              index: idx,
              itemName: item.itemName,
              itemId: item.itemId,
              itemType: item.itemType,
              hasItemId: !!item.itemId
            })))
            setItems(invoiceItems)
            
            // Store invoice type for later use in separate effect
            setActualInvoiceIsMotorcycle(invoiceHasMotorcycle)
          } else {
            console.warn('Invoice has no items or items array is empty')
          }
          
          invoiceLoadedRef.current = true
        }
      } catch (error) {
        console.error('Error loading invoice:', error)
      }
    }
    
    loadInvoice()
  }, [invoiceId, isMotorcycle])
  
  // Restore form state from localStorage when tab loads
  // This MUST run before any save effects
  // Skip if loading invoice (edit mode)
  React.useEffect(() => {
    if (invoiceId && !invoiceLoadedRef.current) return // Wait for invoice to load first
    
    // Clear any pending restore timeout
    if (restoreTimeoutRef.current) {
      clearTimeout(restoreTimeoutRef.current)
    }
    
    // Reset restore flag when tabId changes
    hasRestoredRef.current = false
    isRestoringRef.current = true
    
    // Use a small delay to ensure this runs before save effects
    const timeoutId = setTimeout(() => {
      try {
        const savedState = localStorage.getItem(`sales-invoice-form-${tabId}`)
        if (savedState) {
          const formState: FormState = JSON.parse(savedState)
          
          console.log('Restoring form state for tab:', tabId, 'Items:', formState.items?.length || 0)
          
          // Restore all form fields - restore even if empty arrays
          // BUT: When editing an invoice, don't restore namingSeries from localStorage
          // The invoice number should come from the invoice, not localStorage
          if (formState.draftId !== undefined) setDraftId(formState.draftId)
          if (formState.draftStatus !== undefined) setDraftStatus(formState.draftStatus)
          // Only restore namingSeries if NOT editing an invoice
          // When editing, namingSeries is set from invoice.invoiceNumber in loadInvoice
          if (!invoiceId && formState.namingSeries !== undefined) {
            setNamingSeries(formState.namingSeries)
          }
          if (formState.customerId !== undefined) setCustomerId(formState.customerId)
          if (formState.customerName !== undefined) setCustomerName(formState.customerName)
          if (formState.selectedCustomer !== undefined) setSelectedCustomer(formState.selectedCustomer)
          // For wholesale, always require fetchCustomer to be true (mandatory database selection)
          // For retail, restore the saved fetchCustomer state
          if (isWholesale) {
            setFetchCustomer(true) // Always true for wholesale
          } else if (formState.fetchCustomer !== undefined) {
            setFetchCustomer(formState.fetchCustomer) // Restore for retail
          }
          if (formState.date !== undefined) setDate(formState.date)
          if (formState.postingDate !== undefined) setPostingDate(formState.postingDate)
          if (formState.postingTime !== undefined) setPostingTime(formState.postingTime)
          if (formState.dueDate !== undefined) setDueDate(formState.dueDate)
          if (formState.currency !== undefined) setCurrency(formState.currency)
          if (formState.isReturn !== undefined) setIsReturn(formState.isReturn)
          if (formState.isPos !== undefined) setIsPos(formState.isPos)
          if (formState.updateStock !== undefined) setUpdateStock(formState.updateStock)
          // Restore items, but NOT if we're editing an invoice (invoiceId exists)
          // When editing, items should come from the invoice, not localStorage
          // Note: Stock quantities will be validated before processing/submitting
          if (!invoiceId && formState.items !== undefined && Array.isArray(formState.items)) {
            setItems(formState.items)
            console.log('Restored items from localStorage:', formState.items.length, 'items')
          } else if (invoiceId) {
            console.log('Skipping items restore - editing invoice, items should come from API')
          }
          if (formState.discountEnabled !== undefined) setDiscountEnabled(formState.discountEnabled)
          if (formState.discountType !== undefined) setDiscountType(formState.discountType)
          if (formState.discountAmount !== undefined) setDiscountAmount(formState.discountAmount)
          if (formState.totalAdvance !== undefined) setTotalAdvance(formState.totalAdvance)
          // When restoring customer data, reload debt/balance based on invoice type (motorcycle = USD, product = IQD)
          if (formState.selectedCustomer) {
            const customer = formState.selectedCustomer
            if (customer) {
              // Load customer debt and balance based on invoice type (motorcycle vs product)
              // Motorcycles (both retail and wholesale): Use USD debt
              // Products (both retail and wholesale): Use IQD debt and balance
              if (isMotorcycle) {
                // For motorcycle invoices, use USD debt and balance
                setCustomerCurrentDebt(Number(customer.debtUsd || 0))
                setCustomerCurrentBalance(Number(customer.debtUsd || 0))
              } else {
                // For product invoices, use IQD debt and balance
                setCustomerCurrentDebt(Number(customer.debtIqd || 0))
                setCustomerCurrentBalance(Number(customer.currentBalance || 0))
              }
            } else {
              // If no customer was restored but we have saved values, use them
              if (formState.customerCurrentDebt !== undefined) setCustomerCurrentDebt(formState.customerCurrentDebt)
              if (formState.customerCurrentBalance !== undefined) setCustomerCurrentBalance(formState.customerCurrentBalance)
            }
          } else {
            // If no customer restored, use saved values if available
            if (formState.customerCurrentDebt !== undefined) setCustomerCurrentDebt(formState.customerCurrentDebt)
            if (formState.customerCurrentBalance !== undefined) setCustomerCurrentBalance(formState.customerCurrentBalance)
          }
          
          // Notify parent of customer name change
          if (formState.customerName && onCustomerNameChange) {
            onCustomerNameChange(formState.customerName)
          }
          
          console.log('Form state restored for tab:', tabId, 'Items:', formState.items?.length || 0)
          hasRestoredRef.current = true
        } else {
          console.log('No saved state found for tab:', tabId)
          hasRestoredRef.current = true // Mark as restored even if no saved state (new tab)
        }
      } catch (error) {
        console.error('Error restoring form state from localStorage:', error)
        hasRestoredRef.current = true // Mark as restored even on error
      } finally {
        // Mark restoration as complete after state updates settle
        setTimeout(() => {
          isRestoringRef.current = false
        }, 150)
      }
    }, 50) // Small delay to ensure this runs first
    
    restoreTimeoutRef.current = timeoutId
    
    return () => {
      if (restoreTimeoutRef.current) {
        clearTimeout(restoreTimeoutRef.current)
      }
    }
    // Only run on mount or when tabId changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabId])

  // Fetch draft status from API when draftId is available
  React.useEffect(() => {
    const fetchDraftStatus = async () => {
      if (!draftId) return

      try {
        const response = await fetch(`/api/drafts/${draftId}`)
        if (response.ok) {
          const result = await response.json()
          if (result.draft) {
            setDraftStatus(result.draft.status || 'CREATED')
          }
        }
      } catch (error) {
        console.error('Error fetching draft status:', error)
      }
    }

    fetchDraftStatus()
  }, [draftId])

  // Stable callbacks for Switch components to prevent infinite loops
  const handleIsPosChange = React.useCallback((checked: boolean) => {
    setIsPos(checked)
  }, [])

  const handleIsReturnChange = React.useCallback((checked: boolean) => {
    setIsReturn(checked)
  }, [])

  const handleIsDebitNoteChange = React.useCallback((checked: boolean) => {
    setIsDebitNote(checked)
  }, [])

  const handleUpdateStockChange = React.useCallback((checked: boolean) => {
    setUpdateStock(checked)
  }, [])
  
  const handleDiscountEnabledChange = React.useCallback((checked: boolean) => {
    setDiscountEnabled(checked)
  }, [])

  // Fetch customers - only when fetchCustomer is enabled
  React.useEffect(() => {
    if (customerOpen && (isWholesale || (isRetail && fetchCustomer))) {
      fetchCustomers()
    }
  }, [customerOpen, customerSearch, isWholesale, isRetail, fetchCustomer])

  const fetchCustomers = async () => {
    try {
      const response = await fetch(`/api/customers?search=${encodeURIComponent(customerSearch)}&pageSize=50`)
      const data = await response.json()
      if (data.customers) {
        setCustomers(data.customers)
      }
    } catch (error) {
      console.error('Error fetching customers:', error)
    }
  }

  // Fetch products or motorcycles per item when item name changes
  const fetchItemProducts = React.useCallback(async (itemId: string, searchQuery: string) => {
    // If search is empty and we're editing, fetch initial list (first 50 products)
    // Otherwise, only fetch if there's a search query
    if (!searchQuery || !searchQuery.trim()) {
      // When editing, fetch initial list for new items
      if (invoiceId) {
        try {
          const response = await fetch(`/api/products?pageSize=50`)
          const data = await response.json()
          if (data.products) {
            setItemProducts(prev => ({ ...prev, [itemId]: data.products }))
          }
        } catch (error) {
          console.error('Error fetching initial products:', error)
          setItemProducts(prev => ({ ...prev, [itemId]: [] }))
        }
      } else {
        setItemProducts(prev => ({ ...prev, [itemId]: [] }))
      }
      return
    }
    
    try {
      const response = await fetch(`/api/products?search=${encodeURIComponent(searchQuery)}&pageSize=50`)
      const data = await response.json()
      if (data.products) {
        setItemProducts(prev => ({ ...prev, [itemId]: data.products }))
      }
    } catch (error) {
      console.error('Error fetching products:', error)
      setItemProducts(prev => ({ ...prev, [itemId]: [] }))
    }
  }, [invoiceId])

  const fetchItemMotorcycles = React.useCallback(async (itemId: string, searchQuery: string) => {
    // If search is empty and we're editing, fetch initial list (first 50 motorcycles)
    // Otherwise, only fetch if there's a search query
    if (!searchQuery || !searchQuery.trim()) {
      // When editing, fetch initial list for new items
      if (invoiceId) {
        try {
          const response = await fetch(`/api/motorcycles?pageSize=50`)
          const data = await response.json()
          if (data.motorcycles) {
            setItemMotorcycles(prev => ({ ...prev, [itemId]: data.motorcycles }))
          }
        } catch (error) {
          console.error('Error fetching initial motorcycles:', error)
          setItemMotorcycles(prev => ({ ...prev, [itemId]: [] }))
        }
      } else {
        setItemMotorcycles(prev => ({ ...prev, [itemId]: [] }))
      }
      return
    }
    
    try {
      const response = await fetch(`/api/motorcycles?search=${encodeURIComponent(searchQuery)}&pageSize=50`)
      const data = await response.json()
      if (data.motorcycles) {
        setItemMotorcycles(prev => ({ ...prev, [itemId]: data.motorcycles }))
      }
    } catch (error) {
      console.error('Error fetching motorcycles:', error)
      setItemMotorcycles(prev => ({ ...prev, [itemId]: [] }))
    }
  }, [invoiceId])

  // CRITICAL: Load products/motorcycles for dropdown when editing invoice
  // This runs after items are set and functions are defined
  // Use a ref to track which items we've already fetched for to avoid duplicate fetches
  const fetchedItemsRef = React.useRef<Set<string>>(new Set())
  const itemsRef = React.useRef(items)
  
  // Update ref when items change
  React.useEffect(() => {
    itemsRef.current = items
  }, [items])
  
  React.useEffect(() => {
    if (!invoiceId || !invoiceLoadedRef.current) return
    
    const currentItems = itemsRef.current
    
    // Fetch products/motorcycles for each item to populate dropdowns
    currentItems.forEach((item) => {
      // Skip if we've already fetched for this item (to avoid duplicate fetches)
      const itemKey = `${item.id}-${item.itemName || 'empty'}`
      if (fetchedItemsRef.current.has(itemKey)) {
        return
      }
      
      // Use item.itemType directly to determine what to fetch
      if (item.itemType === 'motorcycle') {
        // For items with names, fetch based on the name; otherwise fetch initial list
        if (item.itemName && item.itemName.trim()) {
          fetchItemMotorcycles(item.id, item.itemName)
        } else {
          // New item without name - fetch initial list
          fetchItemMotorcycles(item.id, '')
        }
        fetchedItemsRef.current.add(itemKey)
      } else if (item.itemType === 'product') {
        // For items with names, fetch based on the name; otherwise fetch initial list
        if (item.itemName && item.itemName.trim()) {
          fetchItemProducts(item.id, item.itemName)
        } else {
          // New item without name - fetch initial list
          fetchItemProducts(item.id, '')
        }
        fetchedItemsRef.current.add(itemKey)
      }
    })
    // Stable dependency array - items are accessed via ref to avoid array dependency issues
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId, fetchItemProducts, fetchItemMotorcycles])

  // Calculate totals
  React.useEffect(() => {
    const qty = items.reduce((sum, item) => sum + item.quantity, 0)
    const subtotal = items.reduce((sum, item) => sum + item.amount, 0)
    const taxes = 0 // TODO: Calculate taxes
    
    // Calculate discount
    let discount = 0
    if (discountEnabled && discountAmount > 0) {
      if (discountType === 'percentage') {
        discount = (subtotal * discountAmount) / 100
      } else {
        discount = discountAmount
      }
    }
    
    const grand = subtotal + taxes - discount
    const rounded = Math.round(grand)
    const rounding = rounded - grand

    setTotalQty(qty)
    setTotal(subtotal)
    setTotalTaxes(taxes)
    setDiscountValue(discount)
    setGrandTotal(grand)
    setRoundingAdjustment(rounding)
    setRoundedTotal(rounded)
  }, [items, discountEnabled, discountType, discountAmount])
  
  // Calculate outstanding amount separately to avoid loop
  React.useEffect(() => {
    const outstanding = grandTotal - totalAdvance
    setOutstandingAmount(outstanding)
  }, [grandTotal, totalAdvance])
  
  // For retail: automatically set payment to grand total (only when grandTotal changes, not totalAdvance)
  React.useEffect(() => {
    if (isRetail && grandTotal > 0) {
      setTotalAdvance(prev => {
        // Only update if it's different to prevent loops
        if (Math.abs(prev - grandTotal) > 0.01) {
          return grandTotal
        }
        return prev
      })
    }
  }, [grandTotal, isRetail])

  // Use ref to track draftId to avoid recreating callback
  const draftIdRef = React.useRef(draftId)
  React.useEffect(() => {
    draftIdRef.current = draftId
  }, [draftId])

  // Auto-save draft with debounce and save state tracking
  const isSavingRef = React.useRef(false)
  const autoSaveDraft = React.useCallback(
    debounce(async (data: any) => {
      // Prevent concurrent saves
      if (isSavingRef.current) {
        return
      }
      
      try {
        isSavingRef.current = true
        const currentDraftId = draftIdRef.current
        const url = currentDraftId ? `/api/drafts/${currentDraftId}` : '/api/drafts'
        const method = currentDraftId ? 'PUT' : 'POST'
        
        const response = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
        
        // Check if response is ok
        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error')
          // Log 405 errors for debugging but don't throw
          if (response.status === 405) {
            console.warn(`Method not allowed (405) for ${method} ${url}. This might indicate a routing issue.`)
            return
          }
          throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`)
        }
        
        // Try to parse as JSON, handle empty or non-JSON responses gracefully
        const text = await response.text()
        if (!text || text.trim() === '') {
          // Empty response - might be OK for some endpoints
          return
        }
        
        let result
        try {
          result = JSON.parse(text)
        } catch (parseError) {
          // Not valid JSON - log and return early
          console.warn('Response is not valid JSON:', text.substring(0, 100))
          return
        }
        if (result.draft?.id && !currentDraftId) {
          setDraftId(result.draft.id)
        }
        setIsSaved(true)
        setTimeout(() => setIsSaved(false), 2000)
      } catch (error) {
        console.error('Error auto-saving draft:', error)
      } finally {
        isSavingRef.current = false
      }
    }, 1000),
    [] // Empty dependency array - draftId is accessed via ref
  )

  // Track if component has mounted to prevent initial auto-save
  const isMountedRef = React.useRef(false)
  React.useEffect(() => {
    isMountedRef.current = true
  }, [])

  // NOTE: We NO LONGER auto-save to database
  // localStorage is saved immediately and forcefully (see saveFormState effect above)
  // Database save only happens when user clicks "Save" button (see handleSave below)
  // This is a better practice - localStorage for drafts, database for final saves

  // Add empty row
  // Add empty row - use useCallback to prevent recreation and functional update
  const handleAddRow = React.useCallback(() => {
    setItems(prevItems => {
      // When editing, use actualInvoiceIsMotorcycle to determine item type
      // Otherwise, use saleType prop
      const isMotorcycleInvoice = invoiceId 
        ? (actualInvoiceIsMotorcycle ?? isMotorcycle)
        : isMotorcycle
      
      const newItem: InvoiceItem = {
        id: `item-${Date.now()}-${Math.random()}`,
        itemId: null,
        itemName: "",
        itemType: isMotorcycleInvoice ? 'motorcycle' : 'product',
        quantity: 0,
        rate: 0,
        amount: 0,
        stockQuantity: undefined, // No stock info until item is selected
        isProductInDatabase: false,
        productNotFound: false,
      }
      
      const newItems = [...prevItems, newItem]
      
      // Automatically fetch motorcycles/products for the new item when editing
      // This ensures dropdown is populated immediately
      if (invoiceId) {
        // Use setTimeout to ensure state is updated first
        setTimeout(() => {
          if (newItem.itemType === 'motorcycle') {
            // Fetch motorcycles with empty search to get initial list
            fetchItemMotorcycles(newItem.id, '')
            // Open dropdown to show fetched motorcycles
            setItemOpen(prev => ({ ...prev, [newItem.id]: true }))
          } else if (newItem.itemType === 'product') {
            // Fetch products with empty search to get initial list
            fetchItemProducts(newItem.id, '')
            // Open dropdown to show fetched products
            setItemOpen(prev => ({ ...prev, [newItem.id]: true }))
          }
        }, 150) // Small delay to ensure state is updated
      }
      
      return newItems
    })
  }, [isProduct, isMotorcycle, invoiceId, actualInvoiceIsMotorcycle, fetchItemProducts, fetchItemMotorcycles])

  // Add item from database
  const handleAddItem = (item: Product | Motorcycle) => {
    const isProductItem = 'mufradPrice' in item
    const price = isProductItem
      ? (isWholesale ? item.jumlaPrice : item.mufradPrice)
      : (isWholesale ? item.usdWholesalePrice : item.usdRetailPrice)
    
    const newItem: InvoiceItem = {
      id: `item-${Date.now()}`,
      itemId: item.id,
      itemName: isProductItem ? item.name : (item.name || `${(item as any).brand || ''} ${(item as any).model || ''}`.trim()),
      itemType: isProductItem ? 'product' : 'motorcycle',
      quantity: 0,
      rate: Number(price),
      amount: 0,
      stockQuantity: item.stockQuantity, // Store available stock quantity
      isProductInDatabase: true,
      productNotFound: false,
      originalPrice: Number(price), // Store original price for comparison
    }
    
    // Validate quantity against stock
    if (item.stockQuantity <= 0) {
      setAlertDialog({
        open: true,
        type: 'error',
        title: 'Out of Stock',
        message: `${isProductItem ? 'Product' : 'Motorcycle'} "${newItem.itemName}" is out of stock. Available quantity: ${item.stockQuantity}`,
      })
      return
    }
    
    setItems([...items, newItem])
    setItemOpen({})
  }
  
  // Search for product or motorcycle when name is entered
  const searchItemRef = React.useRef<((itemId: string, itemName: string) => void) | null>(null)
  
  React.useEffect(() => {
    const searchItem = async (itemId: string, itemName: string) => {
      if (!itemName || itemName.trim() === '') {
        return
      }
      
      // Only search if we're in the correct mode (products for product mode, motorcycles for motorcycle mode)
      if (isProduct) {
        // Search for products
        try {
          const response = await fetch(`/api/products?search=${encodeURIComponent(itemName)}&pageSize=10`)
          if (response.ok) {
            const data = await response.json()
            const foundProducts = data.products || []
            // Try to find exact match first, then partial match
            const foundProduct = foundProducts.find((p: Product) => 
              p.name.toLowerCase() === itemName.toLowerCase()
            ) || foundProducts.find((p: Product) => 
              p.name.toLowerCase().includes(itemName.toLowerCase()) || 
              itemName.toLowerCase().includes(p.name.toLowerCase())
            )
            
            setItems(currentItems => currentItems.map(item => {
              if (item.id === itemId) {
                if (foundProduct) {
                  // Product found - auto-fill price and stock quantity
                  const price = isWholesale ? foundProduct.jumlaPrice : foundProduct.mufradPrice
                  // Only update rate if:
                  // 1. Item doesn't have an itemId yet (new item), OR
                  // 2. Item has a different itemId (switching to different product), OR
                  // 3. Rate is 0 (not set yet)
                  // Otherwise, preserve the user's manually set rate
                  const isNewItem = !item.itemId
                  const isSwitchingItem = item.itemId && item.itemId !== foundProduct.id
                  const rateNotSet = item.rate === 0
                  const shouldUpdateRate = isNewItem || isSwitchingItem || rateNotSet
                  
                  const updatedItem = {
                    ...item,
                    itemId: foundProduct.id,
                    // Only update rate if conditions above are met, otherwise preserve user's manual changes
                    rate: shouldUpdateRate ? Number(price) : item.rate,
                    stockQuantity: foundProduct.stockQuantity, // Store stock quantity
                    isProductInDatabase: true,
                    productNotFound: false,
                    originalPrice: Number(price), // Store original price for comparison
                  }
                  // Validate quantity against stock
                  if (updatedItem.quantity > foundProduct.stockQuantity) {
                    setAlertDialog({
                      open: true,
                      type: 'error',
                      title: t('insufficientStock'),
                      message: t('availableStockFor', { name: foundProduct.name, quantity: foundProduct.stockQuantity, current: updatedItem.quantity }),
                    })
                    updatedItem.quantity = foundProduct.stockQuantity
                  }
                  updatedItem.amount = updatedItem.quantity * updatedItem.rate
                  return updatedItem
                } else {
                  // Product not found
                  return {
                    ...item,
                    stockQuantity: undefined, // Clear stock quantity
                    isProductInDatabase: false,
                    productNotFound: true,
                  }
                }
              }
              return item
            }))
          }
        } catch (error) {
          console.error('Error searching product:', error)
        }
      } else if (isMotorcycle) {
        // Search for motorcycles
        try {
          const response = await fetch(`/api/motorcycles?search=${encodeURIComponent(itemName)}&pageSize=10`)
          if (response.ok) {
            const data = await response.json()
            const foundMotorcycles = data.motorcycles || []
            // Try to find exact match first, then partial match
            const searchLower = itemName.toLowerCase()
            const foundMotorcycle = foundMotorcycles.find((m: Motorcycle) => {
              // Use name if available, otherwise fallback to brand + model
              const fullName = (m.name || `${(m as any).brand || ''} ${(m as any).model || ''}`).toLowerCase().trim()
              return fullName === searchLower || m.sku.toLowerCase() === searchLower
            }) || foundMotorcycles.find((m: Motorcycle) => {
              // Use name if available, otherwise fallback to brand + model
              const fullName = (m.name || `${(m as any).brand || ''} ${(m as any).model || ''}`).toLowerCase().trim()
              return fullName.includes(searchLower) || 
                     searchLower.includes(fullName) ||
                     m.name?.toLowerCase().includes(searchLower) ||
                     ((m as any).brand?.toLowerCase().includes(searchLower)) ||
                     ((m as any).model?.toLowerCase().includes(searchLower)) ||
                     m.sku.toLowerCase().includes(searchLower)
            })
            
            setItems(currentItems => currentItems.map(item => {
              if (item.id === itemId) {
                if (foundMotorcycle) {
                  // Motorcycle found - auto-fill price and stock quantity
                  const price = isWholesale ? foundMotorcycle.usdWholesalePrice : foundMotorcycle.usdRetailPrice
                  const priceValue = typeof price === 'string' ? parseFloat(price) || 0 : price || 0
                  // Only update rate if:
                  // 1. Item doesn't have an itemId yet (new item), OR
                  // 2. Item has a different itemId (switching to different motorcycle), OR
                  // 3. Rate is 0 (not set yet)
                  // Otherwise, preserve the user's manually set rate
                  const isNewItem = !item.itemId
                  const isSwitchingItem = item.itemId && item.itemId !== foundMotorcycle.id
                  const rateNotSet = item.rate === 0
                  const shouldUpdateRate = isNewItem || isSwitchingItem || rateNotSet
                  
                  const updatedItem = {
                    ...item,
                    itemId: foundMotorcycle.id,
                    itemName: `${foundMotorcycle.brand} ${foundMotorcycle.model}`,
                    // Only update rate if conditions above are met, otherwise preserve user's manual changes
                    rate: shouldUpdateRate ? priceValue : item.rate,
                    stockQuantity: foundMotorcycle.stockQuantity, // Store stock quantity
                    isProductInDatabase: true,
                    productNotFound: false,
                    originalPrice: priceValue, // Store original price for comparison
                  }
                  // Validate quantity against stock
                  if (updatedItem.quantity > foundMotorcycle.stockQuantity) {
                    setAlertDialog({
                      open: true,
                      type: 'error',
                      title: t('insufficientStock'),
                      message: t('availableStockFor', { name: updatedItem.itemName, quantity: foundMotorcycle.stockQuantity, current: updatedItem.quantity }),
                    })
                    updatedItem.quantity = foundMotorcycle.stockQuantity
                  }
                  updatedItem.amount = updatedItem.quantity * updatedItem.rate
                  return updatedItem
                } else {
                  // Motorcycle not found
                  return {
                    ...item,
                    stockQuantity: undefined, // Clear stock quantity
                    isProductInDatabase: false,
                    productNotFound: true,
                  }
                }
              }
              return item
            }))
          }
        } catch (error) {
          console.error('Error searching motorcycle:', error)
        }
      }
    }
    
    searchItemRef.current = debounce(searchItem as (...args: unknown[]) => unknown, 500) as (itemId: string, itemName: string) => void
  }, [isWholesale, isProduct, isMotorcycle])
  
  const searchItem = React.useCallback((itemId: string, itemName: string) => {
    if (searchItemRef.current) {
      searchItemRef.current(itemId, itemName)
    }
  }, [])
  
  // Debounced fetch refs for per-item
  const fetchTimeoutsRef = React.useRef<{ [key: string]: NodeJS.Timeout }>({})
  
  // Update item name and fetch products/motorcycles for dropdown
  const handleUpdateItemName = React.useCallback((id: string, name: string) => {
    setItems(prevItems => {
      return prevItems.map(item => {
        if (item.id === id) {
          const updated = { ...item, itemName: name }
          // If name changed, reset item status
          if (name !== item.itemName) {
            updated.itemId = null
            updated.isProductInDatabase = false
            updated.productNotFound = false
            // If name is cleared, reset all fields
            if (!name.trim()) {
              updated.rate = 0
              updated.quantity = 0
              updated.amount = 0
              setItemProducts(prev => ({ ...prev, [id]: [] }))
              setItemMotorcycles(prev => ({ ...prev, [id]: [] }))
            } else {
              // Clear previous timeout
              if (fetchTimeoutsRef.current[id]) {
                clearTimeout(fetchTimeoutsRef.current[id])
              }
              // Debounce fetch - wait 300ms after user stops typing
              // Use item.itemType directly (not saleType) to ensure correct fetch
              fetchTimeoutsRef.current[id] = setTimeout(() => {
                if (item.itemType === 'product') {
                  fetchItemProducts(id, name)
                } else if (item.itemType === 'motorcycle') {
                  fetchItemMotorcycles(id, name)
                }
              }, 300)
            }
          }
          return updated
        }
        return item
      })
    })
  }, [isProduct, isMotorcycle, fetchItemProducts, fetchItemMotorcycles])

  // Update item
  const handleUpdateItem = (id: string, field: 'quantity' | 'rate', value: number) => {
    setItems(prevItems => {
      const updatedItems = prevItems.map(item => {
        if (item.id === id) {
          const updated = { ...item, [field]: value }
          
          // Validate quantity against available stock (calculated dynamically)
          if (field === 'quantity' && updated.stockQuantity !== undefined && updated.stockQuantity !== null) {
            // Calculate available stock: original stock minus quantities from other items of same product
            const totalQuantityInInvoice = prevItems
              .filter(i => i.itemId === updated.itemId && i.itemType === updated.itemType && i.id !== id)
              .reduce((sum, i) => sum + (i.quantity || 0), 0)
            const otherItemsQuantity = totalQuantityInInvoice
            const availableStock = Math.max(0, updated.stockQuantity - otherItemsQuantity)
            
            if (value > availableStock) {
              setAlertDialog({
                open: true,
                type: 'error',
                title: t('insufficientStock'),
                message: t('availableStock', { quantity: availableStock, name: updated.itemName }),
              })
              // Set quantity to available stock
              updated.quantity = availableStock
            }
          }
          
          updated.amount = updated.quantity * updated.rate
          return updated
        }
        return item
      })
      return updatedItems
    })
  }

  // Remove item
  const handleRemoveItem = (id: string) => {
    setItems(items.filter(item => item.id !== id))
  }

  // Calculate available stock for an item (original stock minus quantities already in invoice)
  const calculateAvailableStock = React.useCallback((item: InvoiceItem): number | undefined => {
    if (item.stockQuantity === undefined || item.stockQuantity === null) {
      return undefined
    }
    
    // If item doesn't have an itemId, we can't calculate (not selected from database)
    if (!item.itemId) {
      return item.stockQuantity
    }
    
    // Sum all quantities for the same product/motorcycle in the invoice
    const totalQuantityInInvoice = items
      .filter(i => i.itemId === item.itemId && i.itemType === item.itemType)
      .reduce((sum, i) => sum + (i.quantity || 0), 0)
    
    // Available stock = original stock - (total quantity in invoice - current item quantity)
    // This gives us: original stock - quantities from other items of the same product
    const otherItemsQuantity = totalQuantityInInvoice - (item.quantity || 0)
    const availableStock = Math.max(0, item.stockQuantity - otherItemsQuantity)
    
    return availableStock
  }, [items])

  // Format IQD amount without decimals
  const formatIqd = (amount: number): string => {
    const rounded = Math.round(amount)
    return rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  }

  // Format currency based on invoice type (motorcycle = USD, product = IQD)
  const formatCurrency = (amount: number): string => {
    return formatIqd(amount)
  }
  
  // Get currency symbol based on invoice type
  // When editing, use the actual detected invoice type, otherwise use saleType prop
  const getCurrencySymbol = (): string => {
    const isMotorcycleInvoice = invoiceId 
      ? (actualInvoiceIsMotorcycle ?? (currency === 'USD'))
      : isMotorcycle
    return isMotorcycleInvoice ? '$' : 'ع.د '
  }
  
  // Get currency label (IQD or USD)
  // When editing, use the actual detected invoice type, otherwise use saleType prop
  const getCurrencyLabel = (): string => {
    const isMotorcycleInvoice = invoiceId 
      ? (actualInvoiceIsMotorcycle ?? (currency === 'USD'))
      : isMotorcycle
    return isMotorcycleInvoice ? 'USD' : 'IQD'
  }

  // Handle save - saves to DATABASE as draft
  const handleSave = async () => {
    // For wholesale (both product and motorcycle): customer must be selected from database
    if (isWholesale && (!selectedCustomer || !customerId)) {
      setAlertDialog({
        open: true,
        type: 'error',
        title: t('customerRequired'),
        message: t('validCustomerRequiredForWholesale', {
          type: isMotorcycle ? t('wholesaleMotorcycle.title').toLowerCase() : t('wholesaleProduct.title').toLowerCase()
        }),
      })
      return
    }

    if (items.length === 0) {
      setAlertDialog({
        open: true,
        type: 'error',
        title: t('itemsRequired'),
        message: t('pleaseAddAtLeastOneItem'),
      })
      return
    }

    setIsSaving(true)
    try {
      // First, ensure localStorage is up to date (should already be, but just in case)
      saveFormState()
      
      // Calculate discount value for API (as percentage if percentage type, otherwise calculate percentage)
      const discountValue = discountEnabled && discountAmount > 0
        ? (discountType === 'percentage' ? discountAmount : (discountAmount / total * 100))
        : 0
      
      // If editing an invoice, update the invoice directly
      if (invoiceId) {
        // Determine currency based on invoice type
        const invoiceCurrency = isMotorcycle ? 'USD' : 'IQD'
        const newAmountDue = grandTotal - (totalAdvance || 0)
        
        // Calculate new payment status
        // API only accepts PAID or PARTIALLY_PAID (not FINALIZED)
        const amountPaid = totalAdvance || 0
        let newStatus: 'PAID' | 'PARTIALLY_PAID' = 'PARTIALLY_PAID'
        if (Math.abs(amountPaid - grandTotal) < 0.01 || amountPaid >= grandTotal) {
          newStatus = 'PAID'
        } else {
          // If amountPaid is 0 or less than total, it's PARTIALLY_PAID
          newStatus = 'PARTIALLY_PAID'
        }
        
        // Validate and prepare items for saving
        // We save items even if itemId is missing - the API will handle it
        const itemsWithValidation = items.map((item, index) => {
          if (item.itemType === 'product' && !item.itemId) {
            console.warn(`Item ${index} (${item.itemName}) is missing itemId! Saving without productId.`, item)
          }
          if (item.itemType === 'motorcycle' && !item.itemId) {
            console.warn(`Item ${index} (${item.itemName}) is missing itemId! Saving without ID.`, item)
          }
          return {
            productId: item.itemType === 'product' ? (item.itemId || null) : null,
            quantity: item.quantity,
            unitPrice: item.rate,
            discount: 0,
            taxRate: 0,
            lineTotal: item.amount,
            notes: item.itemType === 'motorcycle' ? (item.itemId ? `MOTORCYCLE:${item.itemId}` : undefined) : undefined,
            order: index,
          }
        })
        
        console.log('Saving invoice with items:', itemsWithValidation.map((item, idx) => ({
          index: idx,
          productId: item.productId,
          name: items[idx].itemName,
          itemId: items[idx].itemId
        })))
        
        const invoiceData = {
          customerId: customerId || null,
          invoiceDate: date ? new Date(date).toISOString() : new Date().toISOString(),
          dueDate: dueDate ? new Date(dueDate).toISOString() : null,
          subtotal: total,
          taxAmount: totalTaxes,
          discount: discountValue,
          total: grandTotal,
          amountPaid: amountPaid,
          amountDue: newAmountDue,
          currency: invoiceCurrency,
          status: newStatus,
          items: itemsWithValidation,
        }
        
        const response = await fetch(`/api/invoices/${invoiceId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(invoiceData),
        })
        
        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error')
          throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`)
        }
        
        const result = await response.json()
        
        if (result.invoice) {
          // CRITICAL: Reload invoice data to get updated stock quantities
          // After saving, stock has been updated in the database, so we need to refresh
          // Reset the ref to allow reloading
          invoiceLoadedRef.current = false
          
          // Reload invoice data to get fresh stock quantities
          try {
            const reloadResponse = await fetch(`/api/invoices/${invoiceId}`)
            if (reloadResponse.ok) {
              const reloadData = await reloadResponse.json()
              const reloadedInvoice = reloadData.invoice
              
              // Update items with fresh stock quantities from database
              if (reloadedInvoice.items && reloadedInvoice.items.length > 0) {
                setItems(prevItems => {
                  return prevItems.map(prevItem => {
                    // Find matching item in reloaded invoice
                    const reloadedItem = reloadedInvoice.items.find((ri: any) => {
                      if (prevItem.itemType === 'motorcycle') {
                        // For motorcycles, match by notes (MOTORCYCLE:id)
                        return ri.notes?.startsWith('MOTORCYCLE:') && 
                               ri.notes.replace('MOTORCYCLE:', '') === prevItem.itemId
                      } else {
                        // For products, match by productId
                        return ri.productId === prevItem.itemId
                      }
                    })
                    
                    if (reloadedItem) {
                      // Update stock quantity from database
                      // For products, get from product relation
                      // For motorcycles, we need to fetch separately
                      let updatedStockQuantity = prevItem.stockQuantity
                      
                      if (prevItem.itemType === 'product' && reloadedItem.product) {
                        // Product: use stock from product relation
                        // When editing, we need to add back the quantity sold in this invoice
                        // to show the restored stock (available stock for editing)
                        updatedStockQuantity = reloadedItem.product.stockQuantity + reloadedItem.quantity
                      } else if (prevItem.itemType === 'motorcycle') {
                        // Motorcycle: fetch fresh stock (product relation won't have it)
                        // We'll update this in a separate effect to avoid blocking
                        // For now, keep the current stockQuantity
                      }
                      
                      return {
                        ...prevItem,
                        stockQuantity: updatedStockQuantity,
                      }
                    }
                    return prevItem
                  })
                })
                
                // For motorcycles, fetch fresh stock quantities
                // Get current items to find motorcycles
                setItems(currentItems => {
                  const motorcycleItems = currentItems.filter(item => item.itemType === 'motorcycle' && item.itemId)
                  if (motorcycleItems.length > 0) {
                    // Fetch motorcycle stock in parallel
                    Promise.all(
                      motorcycleItems.map(async (item) => {
                        if (!item.itemId) return null
                        try {
                          const motoResponse = await fetch(`/api/motorcycles/${item.itemId}`)
                          if (motoResponse.ok) {
                            const motoData = await motoResponse.json()
                            const reloadedMotoItem = reloadedInvoice.items.find((ri: any) => 
                              ri.notes?.startsWith('MOTORCYCLE:') && 
                              ri.notes.replace('MOTORCYCLE:', '') === item.itemId
                            )
                            // Get current stock and add back quantity sold in this invoice (for editing)
                            const currentStock = motoData.motorcycle?.stockQuantity || 0
                            const restoredStock = currentStock + (reloadedMotoItem?.quantity || 0)
                            return { itemId: item.id, stockQuantity: restoredStock }
                          }
                        } catch (error) {
                          console.error(`Error fetching motorcycle ${item.itemId}:`, error)
                        }
                        return null
                      })
                    ).then(stockUpdates => {
                      setItems(prevItems => {
                        return prevItems.map(prevItem => {
                          const stockUpdate = stockUpdates.find(su => su?.itemId === prevItem.id)
                          if (stockUpdate) {
                            return {
                              ...prevItem,
                              stockQuantity: stockUpdate.stockQuantity,
                            }
                          }
                          return prevItem
                        })
                      })
                    })
                  }
                  return currentItems
                })
              }
            }
          } catch (reloadError) {
            console.error('Error reloading invoice after save:', reloadError)
            // Don't fail the save operation if reload fails
          }
          
          setAlertDialog({
            open: true,
            type: 'success',
            title: t('invoiceUpdated'),
            message: t('invoiceUpdatedSuccessfully'),
          })
        }
      } else {
        // Create or update draft (new invoice mode)
        // For wholesale, customerId is required and must be valid
        // For retail, customerId can be null/undefined
        const validCustomerId = customerId && customerId.trim() !== '' ? customerId.trim() : undefined
        
      // Double-check wholesale has customer (both product and motorcycle)
      if (isWholesale && !validCustomerId) {
        setAlertDialog({
          open: true,
          type: 'error',
          title: 'Customer Required',
          message: `A valid customer from the database is required for wholesale ${isMotorcycle ? 'motorcycle' : 'product'} sales. Please select an existing customer from the database.`,
        })
        setIsSaving(false)
        return
      }
        
        // Determine invoice type for tracking: wholesale-product, retail-product, wholesale-motorcycle, retail-motorcycle
        const invoiceType = `${isWholesale ? 'wholesale' : 'retail'}-${isMotorcycle ? 'motorcycle' : 'product'}`
        
        const draftData = {
          type: isWholesale ? 'JUMLA' : 'MUFRAD',
          customerId: validCustomerId || undefined, // Use undefined instead of null for optional field
          items: items.map((item, index) => ({
            productId: item.itemType === 'product' ? item.itemId : null,
            quantity: item.quantity,
            unitPrice: item.rate,
            discount: 0, // Item-level discount (currently not used in form)
            taxRate: 0, // Item-level tax rate (currently not used in form)
            notes: item.itemType === 'motorcycle' ? `MOTORCYCLE:${item.itemId}` : undefined,
          })),
          subtotal: total,
          taxAmount: totalTaxes,
          discount: discountValue, // Invoice-level discount as percentage
          total: grandTotal,
          notes: `${namingSeries || ''} [INVOICE_TYPE:${invoiceType}]`.trim(), // Store invoice type in notes for tracking
        }

        // Use PUT for updates, POST for new drafts
        const validDraftId = draftId && typeof draftId === 'string' && draftId.trim() !== '' ? draftId.trim() : null
        const url = validDraftId ? `/api/drafts/${validDraftId}` : '/api/drafts'
        const method = validDraftId ? 'PUT' : 'POST'
        
        console.log('Saving draft:', { url, method, draftId: validDraftId, hasItems: items.length > 0 })
        
        const response = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(draftData),
        })
        
        // Check if response is ok
        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error')
          console.error('Draft save error:', { status: response.status, errorText, url, method })
          throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`)
        }
        
        // Parse response
        const result = await response.json()
        
        if (result.draft) {
          const savedDraft = result.draft
          if (!draftId) {
            setDraftId(savedDraft.id)
          }
          setDraftStatus(savedDraft.status || 'CREATED')
          setIsSaved(true)
          setTimeout(() => setIsSaved(false), 2000)
        }
      }
    } catch (error) {
      console.error('Error saving:', error)
      setAlertDialog({
        open: true,
        type: 'error',
        title: invoiceId ? t('errorUpdatingInvoice') : t('errorSavingDraft'),
        message: error instanceof Error ? error.message : (invoiceId ? 'Error updating invoice. Please try again.' : 'Error saving draft. Please try again.'),
      })
    } finally {
      setIsSaving(false)
    }
  }

  // Handle submit - finalizes the draft
  const handleSubmitClick = () => {
    // Show confirmation dialog
    setShowSubmitConfirm(true)
  }

  const handleSubmit = async () => {
    setShowSubmitConfirm(false)
    
    // For wholesale (both product and motorcycle): customer must be selected from database
    if (isWholesale && (!selectedCustomer || !customerId)) {
      setAlertDialog({
        open: true,
        type: 'error',
        title: t('customerRequired'),
        message: t('validCustomerRequiredForWholesale', {
          type: isMotorcycle ? t('wholesaleMotorcycle.title').toLowerCase() : t('wholesaleProduct.title').toLowerCase()
        }),
      })
      return
    }
      
    if (items.length === 0) {
      setAlertDialog({
        open: true,
        type: 'error',
        title: t('itemsRequired'),
        message: t('pleaseAddAtLeastOneItem'),
      })
      return
    }

    // Validate stock quantities before submitting
    const stockErrors: string[] = []
    for (const item of items) {
      if (item.itemId && item.stockQuantity !== undefined && item.stockQuantity !== null) {
        // Calculate available stock: original stock minus quantities from other items of same product
        const totalQuantityInInvoice = items
          .filter(i => i.itemId === item.itemId && i.itemType === item.itemType && i.id !== item.id)
          .reduce((sum, i) => sum + (i.quantity || 0), 0)
        const otherItemsQuantity = totalQuantityInInvoice
        const availableStock = Math.max(0, item.stockQuantity - otherItemsQuantity)
        
        if (item.quantity > availableStock) {
          stockErrors.push(`${item.itemName}: Requested ${item.quantity}, but only ${availableStock} available`)
        }
      }
    }
    
    if (stockErrors.length > 0) {
      setAlertDialog({
        open: true,
        type: 'error',
        title: t('insufficientStock'),
        message: `${t('cannotSubmitStockErrors')}\n\n${stockErrors.join('\n')}`,
      })
      return
    }
      
    setIsSubmitting(true)
    try {
      // First, ensure localStorage is up to date
      saveFormState()
      
      // Calculate discount value for API
      const discountValue = discountEnabled && discountAmount > 0
        ? (discountType === 'percentage' ? discountAmount : (discountAmount / total * 100))
        : 0
      
      // Prepare draft data
      // For wholesale, customerId is required and must be valid
      // For retail, customerId can be null/undefined
      const validCustomerId = customerId && customerId.trim() !== '' ? customerId.trim() : undefined
      
      // Double-check wholesale has customer (both product and motorcycle)
      if (isWholesale && !validCustomerId) {
        setAlertDialog({
          open: true,
          type: 'error',
          title: 'Customer Required',
          message: `A valid customer from the database is required for wholesale ${isMotorcycle ? 'motorcycle' : 'product'} sales. Please select an existing customer from the database.`,
        })
        setIsSubmitting(false)
        return
      }
      
      // Determine invoice type for tracking: wholesale-product, retail-product, wholesale-motorcycle, retail-motorcycle
      const invoiceType = `${isWholesale ? 'wholesale' : 'retail'}-${isMotorcycle ? 'motorcycle' : 'product'}`
      
      const draftData = {
        type: isWholesale ? 'JUMLA' : 'MUFRAD',
        customerId: validCustomerId || undefined, // Use undefined instead of null for optional field
        items: items.map((item, index) => ({
          productId: item.itemType === 'product' ? item.itemId : null,
          quantity: item.quantity,
          unitPrice: item.rate,
          discount: 0,
          taxRate: 0,
          notes: item.itemType === 'motorcycle' ? `MOTORCYCLE:${item.itemId}` : undefined,
        })),
        discount: discountValue,
        notes: `${namingSeries || ''} [INVOICE_TYPE:${invoiceType}]`.trim(), // Store invoice type in notes for tracking
      }

      // Save draft first (create or update) if draftId doesn't exist
      let currentDraftId = draftId
      if (!currentDraftId) {
        const validDraftId = draftId && typeof draftId === 'string' && draftId.trim() !== '' ? draftId.trim() : null
        const url = validDraftId ? `/api/drafts/${validDraftId}` : '/api/drafts'
        const method = validDraftId ? 'PUT' : 'POST'
        
        const saveResponse = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(draftData),
        })

        if (!saveResponse.ok) {
          const errorText = await saveResponse.text().catch(() => 'Unknown error')
          throw new Error(`Failed to save draft: ${errorText}`)
        }

        const saveResult = await saveResponse.json()
        if (saveResult.draft) {
          currentDraftId = saveResult.draft.id
          setDraftId(currentDraftId)
        } else {
          throw new Error('Draft ID not available after save')
        }
      } else {
        // Update existing draft
        const saveResponse = await fetch(`/api/drafts/${currentDraftId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(draftData),
        })

        if (!saveResponse.ok) {
          const errorText = await saveResponse.text().catch(() => 'Unknown error')
          throw new Error(`Failed to update draft: ${errorText}`)
        }
      }

      if (!currentDraftId) {
        throw new Error('Draft ID not available')
      }

      // Auto-determine currency based on items:
      // - If any item is a motorcycle, currency is USD
      // - Otherwise, currency is IQD
      const hasMotorcycle = items.some(item => item.itemType === 'motorcycle');
      const invoiceCurrency = hasMotorcycle ? 'USD' : 'IQD';
      
      const response = await fetch(`/api/drafts/${currentDraftId}/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentMethod: isRetail ? 'CASH' : 'CREDIT',
          amountPaid: totalAdvance || 0, // Use actual payment amount, default to 0 if no payment
          invoiceNumber: namingSeries, // Use series as invoice number
          currency: invoiceCurrency, // Auto-determined: USD for motorcycles, IQD for products
          notes: '',
        }),
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error')
        throw new Error(`Failed to submit draft: ${errorText}`)
      }

      const result = await response.json()
      if (result.draft || result.success) {
        setDraftStatus('FINALIZED')
        
        // Show success toast
        toast({
          title: t('invoiceSubmitted'),
          description: (
            <div className="flex items-center gap-2">
              <IconCircleCheck className="h-4 w-4 text-green-600 flex-shrink-0" />
              <span>{t('invoiceSubmittedSuccessfully', { invoiceNumber: result.invoiceNumber || namingSeries || 'N/A' })}</span>
            </div>
          ),
          className: 'border-green-200 bg-green-50 dark:bg-green-950/20',
        })
        
        // Show success dialog with invoice details
        setInvoiceSuccessDialog({
          open: true,
          invoiceNumber: result.invoiceNumber || namingSeries || 'N/A',
          invoiceId: result.invoiceId,
        })
        // Don't auto-close tab - let user choose from dialog buttons
      }
    } catch (error) {
      console.error('Error submitting draft:', error)
      const errorMessage = error instanceof Error ? error.message : 'Error submitting draft. Please try again.'
      
      // Show error toast
      toast({
        title: 'Invoice Submission Failed',
        description: errorMessage,
        variant: 'destructive',
      })
      
      setAlertDialog({
        open: true,
        type: 'error',
        title: t('errorSubmittingDraft'),
        message: errorMessage,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className={cn("flex h-full flex-col overflow-hidden", fontClass)} dir={direction}>
      {/* Header with Title and Action Buttons */}
      <div className="flex-shrink-0 border-b p-6 bg-background">
        <div className="flex flex-col items-center gap-4">
          {/* Centered Title */}
          <h1 className={cn("text-2xl font-semibold text-center", fontClass)}>
            {getApplicationType()}
          </h1>
          
          {/* Status Badges and Action Buttons */}
           <div className="flex items-center justify-between w-full border-t pt-6 mt-6">
   {/* Left: Status Badge (Only for READY status) */}
   <div className="flex items-center gap-2">
     {draftStatus === 'READY' && (
       <Badge variant="default" className="text-xs font-medium bg-blue-500 hover:bg-blue-600 px-3 py-1">
         <span className="inline-block w-1.5 h-1.5 rounded-full bg-white mr-1.5"></span>
         {t('processed')}
       </Badge>
     )}
   </div>
 
   {/* Right: Action Buttons and Submitted Badge */}
   <div className="flex items-center gap-3">
     {draftStatus === 'FINALIZED' && (
       <Badge variant="default" className="text-sm font-semibold bg-green-500 hover:bg-green-600 px-4 py-1.5">
         <span className="inline-block w-2 h-2 rounded-full bg-white mr-2"></span>
         {t('submitted')}
       </Badge>
     )}
     {invoiceId ? (
       // Edit mode - show Save button
       <Button
         onClick={handleSave}
         disabled={isSaving}
         size="lg"
         className="bg-blue-500 hover:bg-blue-600 text-white font-semibold px-8 py-2.5 text-base shadow-sm transition-all hover:shadow-md disabled:opacity-50"
       >
         {isSaving ? (
           <>
             <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
             {t('saving')}
           </>
         ) : (
           <>
             <svg 
               className="w-4 h-4 mr-2" 
               fill="none" 
               stroke="currentColor" 
               viewBox="0 0 24 24"
             >
               <path 
                 strokeLinecap="round" 
                 strokeLinejoin="round" 
                 strokeWidth={2} 
                 d="M5 13l4 4L19 7" 
               />
             </svg>
             {t('saveChanges')}
           </>
         )}
       </Button>
    ) : !draftStatus || draftStatus === 'CREATED' || draftStatus === 'READY' ? (
       <>
         <Button
           onClick={handleSubmitClick}
           disabled={isSubmitting}
           size="lg"
           className="bg-green-600 hover:bg-green-700 text-white font-semibold px-8 py-2.5 text-base shadow-sm transition-all hover:shadow-md disabled:opacity-50"
         >
           {isSubmitting ? (
             <>
               <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
               {t('submitting')}
             </>
           ) : (
             <>
               <svg 
                 className="w-4 h-4 mr-2" 
                 fill="none" 
                 stroke="currentColor" 
                 viewBox="0 0 24 24"
               >
                 <path 
                   strokeLinecap="round" 
                   strokeLinejoin="round" 
                   strokeWidth={2} 
                   d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" 
                 />
               </svg>
               {t('submitDraft')}
             </>
           )}
         </Button>
       </>
     ) : null}
   </div>
 </div>

        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <Tabs 
          value={activeTab} 
          onValueChange={setActiveTab} 
          className="flex h-full flex-col"
        >
          <div className="flex-1 overflow-y-auto p-4" style={{ overflow: 'visible' }}>
            <TabsContent value="details" className="space-y-4 mt-0" style={{ overflow: 'visible' }} suppressHydrationWarning>
              {/* Series & Customer - Compact */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-sm">{t('series')}</Label>
                  <Input
                    value={namingSeries}
                    readOnly
                    disabled
                    placeholder={isRetail ? (customerName ? t('seriesPlaceholderRetail') : t('seriesPlaceholderRetailEmpty')) : (customerId ? t('seriesPlaceholderWholesale') : t('seriesPlaceholderWholesaleEmpty'))}
                    className="bg-muted cursor-not-allowed h-9"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                  <Label className="text-sm">
                    {t('customer')} {isWholesale && <span className="text-red-500">*</span>}
                  </Label>
                    {isRetail && (
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="fetch-customer"
                          checked={fetchCustomer}
                          onCheckedChange={(checked) => {
                            setFetchCustomer(checked)
                            if (!checked) {
                              // When disabling fetch, clear selected customer and allow free text
                              setSelectedCustomer(null)
                              setCustomerId("")
                              setCustomerCurrentDebt(0)
                              setCustomerCurrentBalance(0)
                              setCustomerSearch("")
                              setCustomerOpen(false)
                            }
                          }}
                        />
                        <Label htmlFor="fetch-customer" className="text-xs text-muted-foreground">
                          {t('fetchCustomer')}
                        </Label>
                      </div>
                    )}
                    {isWholesale && (
                      <span className="text-xs text-muted-foreground">
                        {t('mustSelectExistingCustomer')}
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      placeholder={
                        isRetail && !fetchCustomer 
                          ? t('enterCustomerNameWalkin')
                          : isRetail 
                            ? t('enterCustomerNameOptional')
                            : t('searchSelectCustomer')
                      }
                      value={customerName}
                      onChange={(e) => {
                        const value = e.target.value
                        setCustomerName(value)
                        onCustomerNameChange?.(value || null)
                        setCustomerSearch(value)
                        // For wholesale: always require database selection, show suggestions
                        // For retail with fetch enabled: show suggestions
                        if (value && (isWholesale || (isRetail && fetchCustomer))) {
                          setCustomerOpen(true)
                        }
                        // For retail without fetch, allow free text only
                        if (isRetail && !fetchCustomer) {
                          setSelectedCustomer(null)
                          setCustomerId("")
                          setCustomerCurrentDebt(0)
                          setCustomerCurrentBalance(0)
                        }
                        // For wholesale: if user types something but hasn't selected, clear the selection
                        if (isWholesale && !customerOpen) {
                          // Only clear if they're typing a new name (not from selection)
                          // This prevents clearing when a customer is selected
                        }
                      }}
                      onFocus={() => {
                        // Only show suggestions if fetchCustomer is enabled
                        if ((customerSearch || customerName) && (isWholesale || (isRetail && fetchCustomer))) {
                          setCustomerOpen(true)
                        }
                      }}
                      onBlur={() => {
                        // Delay closing to allow clicking on suggestions
                        setTimeout(() => {
                          setCustomerOpen(false)
                          // For wholesale (both product and motorcycle): if user leaves field without selecting a customer from dropdown, clear and show error
                          if (isWholesale && !selectedCustomer && customerName) {
                            // Clear the name if they didn't select from dropdown - wholesale requires database selection
                            setCustomerName("")
                            setCustomerSearch("")
                            setCustomerCurrentDebt(0)
                            setCustomerCurrentBalance(0)
                            setCustomerId("")
                            onCustomerNameChange?.(null)
                            setAlertDialog({
                              open: true,
                              type: 'error',
                              title: t('customerNotFoundInDatabase'),
                              message: t('wholesaleMustSelectCustomer', {
                                type: isMotorcycle ? t('wholesaleMotorcycle.title').toLowerCase() : t('wholesaleProduct.title').toLowerCase(),
                                name: customerName
                              }),
                            })
                          }
                        }, 200)
                      }}
                      className={cn("h-9", isWholesale && !selectedCustomer && customerName && "border-destructive")}
                    />
                    {customerOpen && (customerSearch || customerName) && (isWholesale || (isRetail && fetchCustomer)) && (
                      <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-md max-h-60 overflow-auto">
                        <div className="p-1">
                          {customers.length > 0 ? (
                            customers
                              .filter(c => 
                                !customerSearch || 
                                c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
                                c.sku.toLowerCase().includes(customerSearch.toLowerCase())
                              )
                              .slice(0, 5)
                              .map((customer) => (
                                <div
                                  key={customer.id}
                                  className="px-3 py-2 text-sm hover:bg-accent cursor-default"
                                  onMouseDown={(e) => {
                                    e.preventDefault()
                                    if (isWholesale || (isRetail && fetchCustomer)) {
                                      setSelectedCustomer(customer)
                                      setCustomerId(customer.id)
                                      setCustomerName(customer.name)
                                      onCustomerNameChange?.(customer.name)
                                      // Load customer debt and balance based on invoice type
                                      // Motorcycles (both retail and wholesale): Use USD debt
                                      // Products (both retail and wholesale): Use IQD debt and balance
                                      if (isMotorcycle) {
                                        // Load USD debt for motorcycle invoices (both retail and wholesale)
                                        setCustomerCurrentDebt(Number(customer.debtUsd || 0))
                                        // For motorcycles, use USD debt as balance since we don't have separate USD balance field
                                        // The currentBalance field is typically for IQD, so we use debtUsd for USD balance display
                                        setCustomerCurrentBalance(Number(customer.debtUsd || 0))
                                      } else {
                                        // Load IQD debt and balance for product invoices (both retail and wholesale)
                                        setCustomerCurrentDebt(Number(customer.debtIqd || 0))
                                        setCustomerCurrentBalance(Number(customer.currentBalance || 0))
                                      }
                                      setCustomerOpen(false)
                                    }
                                  }}
                                >
                                  {customer.name} ({customer.sku})
                                </div>
                              ))
                          ) : (
                            // Show message when no customers found
                            <div className="px-3 py-2 text-sm text-muted-foreground">
                              {isWholesale ? (
                                <span>
                                  {t('noCustomerFound', { name: customerSearch || customerName })}
                                  <br />
                                  <span className="text-destructive font-medium">
                                    {t('wholesaleMustSelectFromDatabase', {
                                      type: isMotorcycle ? t('wholesaleMotorcycle.title').toLowerCase() : t('wholesaleProduct.title').toLowerCase()
                                    })}
                                  </span>
                                </span>
                              ) : (
                                <span>{t('noCustomerFoundManual')}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Date Fields - Compact */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label className="text-sm">{t('date')}</Label>
                  <Input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">{t('postingDate')}</Label>
                  <Input
                    type="date"
                    value={postingDate}
                    onChange={(e) => setPostingDate(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">{t('postingTime')}</Label>
                  <Input
                    type="time"
                    value={postingTime}
                    onChange={(e) => setPostingTime(e.target.value)}
                    className="h-9"
                  />
                </div>
              </div>

              {/* Checkboxes - Only Is Return */}
              <div className="flex items-center space-x-2">
                <Switch
                  id="is-return"
                  checked={isReturn}
                  onCheckedChange={handleIsReturnChange}
                />
                <Label htmlFor="is-return" className={cn("text-sm", fontClass)}>{t('isReturnCreditNote')}</Label>
              </div>

              {/* Items Section */}
              <div className="space-y-4 border-t pt-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">{t('items')}</h3>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Switch
                        id="price-aware"
                        checked={priceAwareEnabled}
                        onCheckedChange={setPriceAwareEnabled}
                      />
                      <Label htmlFor="price-aware" className={cn("text-sm cursor-pointer", fontClass)}>
                        نرخ كێشکردن
                      </Label>
                    </div>
                    <Button 
                      variant="default" 
                      size="sm" 
                      className="bg-primary text-primary-foreground"
                      onClick={handleAddRow}
                    >
                      <IconPlus className="h-4 w-4 mr-2" />
                      {t('addRow')}
                    </Button>
                    {isMotorcycle ? (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => {
                          setMotorcycleDialogData(null)
                          setMotorcycleDialogOpen(true)
                        }}
                      >
                        <IconPlus className="h-4 w-4 mr-2" />
                        {t('createNewMotorcycle')}
                      </Button>
                    ) : (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => {
                          setProductDialogData(null)
                          setProductDialogOpen(true)
                        }}
                      >
                        <IconPlus className="h-4 w-4 mr-2" />
                        {t('createNewProduct')}
                      </Button>
                    )}
                  </div>
                </div>

                <div className="border rounded-lg bg-card">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-12 font-semibold">{t('no')}</TableHead>
                        <TableHead className="font-semibold">{t('item')}</TableHead>
                        <TableHead className="w-32 text-right font-semibold">{t('quantity')}</TableHead>
                        <TableHead className="w-40 text-right font-semibold">{t('rate')} ({getCurrencyLabel()})</TableHead>
                        <TableHead className="w-40 text-right font-semibold">{t('amount')} ({getCurrencyLabel()})</TableHead>
                        <TableHead className="w-16 text-center font-semibold">{t('action')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            <div className="flex flex-col items-center gap-2">
                              <IconFileText className="h-12 w-12 text-muted-foreground/30" />
                              <span>{t('noItemsAdded')}</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        items.map((item, index) => (
                          <TableRow key={item.id} className="hover:bg-muted/30">
                            <TableCell className="font-medium">{index + 1}</TableCell>
                            <TableCell className="align-top">
                              <div className="space-y-1 relative">
                                <div className="flex gap-2">
                                  <Input
                                    placeholder={t('enterItemName')}
                                    value={item.itemName}
                                    onChange={(e) => {
                                      const newValue = e.target.value
                                      handleUpdateItemName(item.id, newValue)
                                      if (newValue) {
                                        setItemOpen(prev => ({ ...prev, [item.id]: true }))
                                      } else {
                                        setItemOpen(prev => ({ ...prev, [item.id]: false }))
                                      }
                                    }}
                                    onFocus={() => {
                                      // When editing, fetch items when input is focused (even if itemName is empty)
                                      if (invoiceId) {
                                        // Fetch items based on itemType
                                        if (item.itemType === 'motorcycle') {
                                          // Fetch motorcycles - use empty string to get initial list
                                          fetchItemMotorcycles(item.id, '')
                                        } else if (item.itemType === 'product') {
                                          // Fetch products - use empty string to get initial list
                                          fetchItemProducts(item.id, '')
                                        }
                                      }
                                      // Open dropdown if there's a name or if we're editing (to show fetched items)
                                      if (item.itemName || invoiceId) {
                                        setItemOpen(prev => ({ ...prev, [item.id]: true }))
                                      }
                                    }}
                                    onBlur={() => {
                                      // Delay closing to allow clicking on suggestions
                                      setTimeout(() => {
                                        setItemOpen(prev => ({ ...prev, [item.id]: false }))
                                      }, 200)
                                    }}
                                    className="flex-1"
                                  />
                                  {item.itemType === 'product' && (
                                    <Popover 
                                      open={categoryPopoverOpen[item.id] || false} 
                                      onOpenChange={(open) => {
                                        setCategoryPopoverOpen(prev => ({ ...prev, [item.id]: open }))
                                        if (!open) {
                                          // Reset view state when popover closes
                                          setCategoryViewState(prev => ({ ...prev, [item.id]: 'categories' }))
                                          setCategoryProductSearch(prev => ({ ...prev, [item.id]: '' }))
                                        }
                                      }}
                                    >
                                      <PopoverTrigger asChild>
                                        <Button
                                          type="button"
                                          variant="outline"
                                          className={cn("h-9", fontClass)}
                                        >
                                          پۆل
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-[300px] p-0" align="start">
                                        {(categoryViewState[item.id] || 'categories') === 'categories' ? (
                                          <Command>
                                            <CommandInput placeholder="گەڕان بە پۆل..." />
                                            <CommandList>
                                              <CommandEmpty>هیچ پۆلێک نەدۆزرایەوە</CommandEmpty>
                                              <CommandGroup>
                                                {categories.map((category) => (
                                                  <CommandItem
                                                    key={category.id}
                                                    value={category.id}
                                                    onSelect={() => {
                                                      // Fetch products by category and switch to products view
                                                      fetch(`/api/products?categoryId=${category.id}&pageSize=100`)
                                                        .then(res => res.json())
                                                        .then(data => {
                                                          if (data.products) {
                                                            setSelectedCategoryProducts(prev => ({ ...prev, [item.id]: data.products || [] }))
                                                            setSelectedCategoryId(prev => ({ ...prev, [item.id]: category.id }))
                                                            setCategoryViewState(prev => ({ ...prev, [item.id]: 'products' }))
                                                            setCategoryProductSearch(prev => ({ ...prev, [item.id]: '' }))
                                                          }
                                                        })
                                                        .catch(console.error)
                                                    }}
                                                  >
                                                    {category.name}
                                                  </CommandItem>
                                                ))}
                                              </CommandGroup>
                                            </CommandList>
                                          </Command>
                                        ) : (
                                          <Command>
                                            <div className="flex items-center border-b px-2">
                                              <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0"
                                                onClick={() => {
                                                  setCategoryViewState(prev => ({ ...prev, [item.id]: 'categories' }))
                                                  setCategoryProductSearch(prev => ({ ...prev, [item.id]: '' }))
                                                }}
                                              >
                                                <IconArrowLeft className="h-4 w-4" />
                                              </Button>
                                              <CommandInput 
                                                placeholder="گەڕان بە بەرهەم..." 
                                                value={categoryProductSearch[item.id] || ''}
                                                onValueChange={(value) => {
                                                  setCategoryProductSearch(prev => ({ ...prev, [item.id]: value }))
                                                }}
                                              />
                                            </div>
                                            <CommandList>
                                              <CommandEmpty>هیچ بەرهەمێک نەدۆزرایەوە</CommandEmpty>
                                              <CommandGroup>
                                                {(selectedCategoryProducts[item.id] || [])
                                                  .filter(product => {
                                                    const search = (categoryProductSearch[item.id] || '').toLowerCase()
                                                    return !search || 
                                                      product.name.toLowerCase().includes(search) ||
                                                      product.sku.toLowerCase().includes(search)
                                                  })
                                                  .map((product) => {
                                                    const productPrice = isWholesale ? product.jumlaPrice : product.mufradPrice
                                                    const priceValue = typeof productPrice === 'string' ? parseFloat(productPrice) || 0 : productPrice || 0
                                                    return (
                                                      <CommandItem
                                                        key={product.id}
                                                        value={product.id}
                                                        onSelect={() => {
                                                          // Update item when product is manually selected
                                                          setItems(prevItems => {
                                                            return prevItems.map(prevItem => {
                                                              if (prevItem.id === item.id) {
                                                                const updatedItem = {
                                                                  ...prevItem,
                                                                  itemName: product.name,
                                                                  rate: priceValue,
                                                                  itemId: product.id,
                                                                  stockQuantity: product.stockQuantity,
                                                                  isProductInDatabase: true,
                                                                  productNotFound: false,
                                                                  quantity: 0,
                                                                  originalPrice: priceValue, // Store original price for comparison
                                                                }
                                                                updatedItem.amount = updatedItem.quantity * updatedItem.rate
                                                                return updatedItem
                                                              }
                                                              return prevItem
                                                            })
                                                          })
                                                          // Close popover after selection
                                                          setCategoryPopoverOpen(prev => ({ ...prev, [item.id]: false }))
                                                        }}
                                                      >
                                                        {product.name} ({product.sku}) - {priceValue.toLocaleString()} د.ع
                                                      </CommandItem>
                                                    )
                                                  })}
                                              </CommandGroup>
                                            </CommandList>
                                          </Command>
                                        )}
                                      </PopoverContent>
                                    </Popover>
                                  )}
                                  {item.itemType === 'motorcycle' && (
                                    <Popover 
                                      open={motorcycleCategoryPopoverOpen[item.id] || false} 
                                      onOpenChange={(open) => {
                                        setMotorcycleCategoryPopoverOpen(prev => ({ ...prev, [item.id]: open }))
                                        if (!open) {
                                          // Reset view state when popover closes
                                          setMotorcycleCategoryViewState(prev => ({ ...prev, [item.id]: 'categories' }))
                                          setCategoryMotorcycleSearch(prev => ({ ...prev, [item.id]: '' }))
                                        }
                                      }}
                                    >
                                      <PopoverTrigger asChild>
                                        <Button
                                          type="button"
                                          variant="outline"
                                          className={cn("h-9", fontClass)}
                                        >
                                          پۆل
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-[300px] p-0" align="start">
                                        {(motorcycleCategoryViewState[item.id] || 'categories') === 'categories' ? (
                                          <Command>
                                            <CommandInput placeholder="گەڕان بە پۆل..." />
                                            <CommandList>
                                              <CommandEmpty>هیچ پۆلێک نەدۆزرایەوە</CommandEmpty>
                                              <CommandGroup>
                                                {motorcycleCategories.map((category) => (
                                                  <CommandItem
                                                    key={category.id}
                                                    value={category.id}
                                                    onSelect={() => {
                                                      // Fetch motorcycles by category and switch to motorcycles view
                                                      fetch(`/api/motorcycles?categoryId=${category.id}&pageSize=100`)
                                                        .then(res => res.json())
                                                        .then(data => {
                                                          if (data.motorcycles) {
                                                            setSelectedCategoryMotorcycles(prev => ({ ...prev, [item.id]: data.motorcycles || [] }))
                                                            setSelectedMotorcycleCategoryId(prev => ({ ...prev, [item.id]: category.id }))
                                                            setMotorcycleCategoryViewState(prev => ({ ...prev, [item.id]: 'motorcycles' }))
                                                            setCategoryMotorcycleSearch(prev => ({ ...prev, [item.id]: '' }))
                                                          }
                                                        })
                                                        .catch(console.error)
                                                    }}
                                                  >
                                                    {category.name}
                                                  </CommandItem>
                                                ))}
                                              </CommandGroup>
                                            </CommandList>
                                          </Command>
                                        ) : (
                                          <Command>
                                            <div className="flex items-center border-b px-2">
                                              <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0"
                                                onClick={() => {
                                                  setMotorcycleCategoryViewState(prev => ({ ...prev, [item.id]: 'categories' }))
                                                  setCategoryMotorcycleSearch(prev => ({ ...prev, [item.id]: '' }))
                                                }}
                                              >
                                                <IconArrowLeft className="h-4 w-4" />
                                              </Button>
                                              <CommandInput 
                                                placeholder="گەڕان بە مۆتۆرسیکل..." 
                                                value={categoryMotorcycleSearch[item.id] || ''}
                                                onValueChange={(value) => {
                                                  setCategoryMotorcycleSearch(prev => ({ ...prev, [item.id]: value }))
                                                }}
                                              />
                                            </div>
                                            <CommandList>
                                              <CommandEmpty>هیچ مۆتۆرسیکلێک نەدۆزرایەوە</CommandEmpty>
                                              <CommandGroup>
                                                {(selectedCategoryMotorcycles[item.id] || [])
                                                  .filter(motorcycle => {
                                                    const search = (categoryMotorcycleSearch[item.id] || '').toLowerCase()
                                                    const displayName = (motorcycle.name || `${(motorcycle as any).brand || ''} ${(motorcycle as any).model || ''}`.trim()).toLowerCase()
                                                    return !search || 
                                                      displayName.includes(search) ||
                                                      motorcycle.sku.toLowerCase().includes(search)
                                                  })
                                                  .map((motorcycle) => {
                                                    const motorcyclePrice = isWholesale ? motorcycle.usdWholesalePrice : motorcycle.usdRetailPrice
                                                    const priceValue = typeof motorcyclePrice === 'string' ? parseFloat(motorcyclePrice) || 0 : motorcyclePrice || 0
                                                    const displayName = motorcycle.name || `${(motorcycle as any).brand || ''} ${(motorcycle as any).model || ''}`.trim()
                                                    return (
                                                      <CommandItem
                                                        key={motorcycle.id}
                                                        value={motorcycle.id}
                                                        onSelect={() => {
                                                          // Update item when motorcycle is manually selected
                                                          setItems(prevItems => {
                                                            return prevItems.map(prevItem => {
                                                              if (prevItem.id === item.id) {
                                                                // Only update rate if:
                                                                // 1. Item doesn't have an itemId yet (new item), OR
                                                                // 2. Item has a different itemId (switching to different motorcycle), OR
                                                                // 3. Rate is 0 (not set yet)
                                                                // Otherwise, preserve the user's manually set rate
                                                                const isNewItem = !prevItem.itemId
                                                                const isSwitchingItem = prevItem.itemId && prevItem.itemId !== motorcycle.id
                                                                const rateNotSet = prevItem.rate === 0
                                                                const shouldUpdateRate = isNewItem || isSwitchingItem || rateNotSet
                                                                
                                                                const updatedItem = {
                                                                  ...prevItem,
                                                                  itemName: displayName,
                                                                  // Only update rate if conditions above are met, otherwise preserve user's manual changes
                                                                  rate: shouldUpdateRate ? priceValue : prevItem.rate,
                                                                  itemId: motorcycle.id,
                                                                  stockQuantity: motorcycle.stockQuantity, // Store stock quantity
                                                                  isProductInDatabase: true,
                                                                  productNotFound: false,
                                                                  // Keep existing quantity (same as products) - don't reset to 0
                                                                  quantity: prevItem.quantity || 0,
                                                                  originalPrice: priceValue, // Store original price for comparison
                                                                }
                                                                // Validate quantity against stock (same as products)
                                                                if (updatedItem.quantity > motorcycle.stockQuantity) {
                                                                  setAlertDialog({
                                                                    open: true,
                                                                    type: 'error',
                                                                    title: t('insufficientStock'),
                                                                    message: t('availableStockFor', { name: displayName, quantity: motorcycle.stockQuantity, current: updatedItem.quantity }),
                                                                  })
                                                                  updatedItem.quantity = motorcycle.stockQuantity
                                                                }
                                                                // Calculate amount: quantity * rate
                                                                updatedItem.amount = updatedItem.quantity * updatedItem.rate
                                                                return updatedItem
                                                              }
                                                              return prevItem
                                                            })
                                                          })
                                                          setItemOpen(prev => ({ ...prev, [item.id]: false }))
                                                          setMotorcycleCategoryPopoverOpen(prev => ({ ...prev, [item.id]: false }))
                                                        }}
                                                      >
                                                        <div className="flex items-center justify-between">
                                                          <span>{displayName} ({motorcycle.sku}) - {priceValue} USD</span>
                                                          <span className={cn(
                                                            "text-xs ml-2",
                                                            motorcycle.stockQuantity > 0 ? "text-muted-foreground" : "text-destructive font-medium"
                                                          )}>
                                                            {t('stock')}: {motorcycle.stockQuantity}
                                                          </span>
                                                        </div>
                                                      </CommandItem>
                                                    )
                                                  })}
                                              </CommandGroup>
                                            </CommandList>
                                          </Command>
                                        )}
                                      </PopoverContent>
                                    </Popover>
                                  )}
                                </div>
                                {item.itemType === 'product' && (itemOpen[item.id] || false) && (item.itemName || invoiceId) && (itemProducts[item.id] || []).length > 0 && (
                                  <div className="w-full mt-1 bg-popover border rounded-md shadow-lg">
                                    <div className="p-1">
                                      {(itemProducts[item.id] || []).slice(0, 10).map((product) => {
                                          const productPrice = isWholesale ? product.jumlaPrice : product.mufradPrice
                                          const priceValue = typeof productPrice === 'string' ? parseFloat(productPrice) || 0 : productPrice || 0
                                          return (
                                            <div
                                              key={product.id}
                                              className="px-3 py-2 text-sm hover:bg-accent cursor-default"
                                              onMouseDown={(e) => {
                                                e.preventDefault()
                                                // Update name and rate when product is selected, and calculate amount
                                                setItems(prevItems => {
                                                  return prevItems.map(prevItem => {
                                                    if (prevItem.id === item.id) {
                                                      // Only update rate if:
                                                      // 1. Item doesn't have an itemId yet (new item), OR
                                                      // 2. Item has a different itemId (switching to different product), OR
                                                      // 3. Rate is 0 (not set yet)
                                                      // Otherwise, preserve the user's manually set rate
                                                      const isNewItem = !prevItem.itemId
                                                      const isSwitchingItem = prevItem.itemId && prevItem.itemId !== product.id
                                                      const rateNotSet = prevItem.rate === 0
                                                      const shouldUpdateRate = isNewItem || isSwitchingItem || rateNotSet
                                                      
                                                      const updatedItem = {
                                                        ...prevItem,
                                                        itemName: product.name,
                                                        // Only update rate if conditions above are met, otherwise preserve user's manual changes
                                                        rate: shouldUpdateRate ? priceValue : prevItem.rate,
                                                        itemId: product.id,
                                                        stockQuantity: product.stockQuantity, // Store stock quantity
                                                        isProductInDatabase: true,
                                                        productNotFound: false,
                                                        quantity: 0, // Reset quantity to 0 when product is selected
                                                        originalPrice: priceValue, // Store original price for comparison
                                                      }
                                                      // Calculate amount: quantity * rate (will be 0 since quantity is 0)
                                                      updatedItem.amount = updatedItem.quantity * updatedItem.rate
                                                      return updatedItem
                                                    }
                                                    return prevItem
                                                  })
                                                })
                                                setItemOpen(prev => ({ ...prev, [item.id]: false }))
                                              }}
                                            >
                                              <div className="flex items-center justify-between">
                                                <span>{product.name} ({product.sku}) - {priceValue} ع.د</span>
                                                <span className={cn(
                                                  "text-xs ml-2",
                                                  product.stockQuantity > 0 ? "text-muted-foreground" : "text-destructive font-medium"
                                                )}>
                                                  {t('stock')}: {product.stockQuantity}
                                                </span>
                                              </div>
                                            </div>
                                          )
                                        })}
                                    </div>
                                  </div>
                                )}
                                {item.itemType === 'motorcycle' && (itemOpen[item.id] || false) && (item.itemName || invoiceId) && (itemMotorcycles[item.id] || []).length > 0 && (
                                  <div className="w-full mt-1 bg-popover border rounded-md shadow-lg">
                                    <div className="p-1">
                                      {(itemMotorcycles[item.id] || []).slice(0, 10).map((motorcycle) => {
                                          const motorcyclePrice = isWholesale ? motorcycle.usdWholesalePrice : motorcycle.usdRetailPrice
                                          const priceValue = typeof motorcyclePrice === 'string' ? parseFloat(motorcyclePrice) || 0 : motorcyclePrice || 0
                                          const displayName = motorcycle.name || `${motorcycle.brand || ''} ${motorcycle.model || ''}`.trim()
                                          return (
                                            <div
                                              key={motorcycle.id}
                                              className="px-3 py-2 text-sm hover:bg-accent cursor-default"
                                              onMouseDown={(e) => {
                                                e.preventDefault()
                                                setItems(prevItems => {
                                                  return prevItems.map(prevItem => {
                                                    if (prevItem.id === item.id) {
                                                      // Only update rate if:
                                                      // 1. Item doesn't have an itemId yet (new item), OR
                                                      // 2. Item has a different itemId (switching to different motorcycle), OR
                                                      // 3. Rate is 0 (not set yet)
                                                      // Otherwise, preserve the user's manually set rate
                                                      const isNewItem = !prevItem.itemId
                                                      const isSwitchingItem = prevItem.itemId && prevItem.itemId !== motorcycle.id
                                                      const rateNotSet = prevItem.rate === 0
                                                      const shouldUpdateRate = isNewItem || isSwitchingItem || rateNotSet
                                                      
                                                      const updatedItem = {
                                                        ...prevItem,
                                                        itemName: displayName,
                                                        // Only update rate if conditions above are met, otherwise preserve user's manual changes
                                                        rate: shouldUpdateRate ? priceValue : prevItem.rate,
                                                        itemId: motorcycle.id,
                                                        stockQuantity: motorcycle.stockQuantity, // Store stock quantity
                                                        isProductInDatabase: true,
                                                        productNotFound: false,
                                                        // Keep existing quantity (same as products) - don't reset to 0
                                                        quantity: prevItem.quantity || 0,
                                                      }
                                                      // Validate quantity against stock (same as products)
                                                      if (updatedItem.quantity > motorcycle.stockQuantity) {
                                                        setAlertDialog({
                                                          open: true,
                                                          type: 'error',
                                                          title: t('insufficientStock'),
                                                          message: t('availableStockFor', { name: displayName, quantity: motorcycle.stockQuantity, current: updatedItem.quantity }),
                                                        })
                                                        updatedItem.quantity = motorcycle.stockQuantity
                                                      }
                                                      // Calculate amount: quantity * rate
                                                      updatedItem.amount = updatedItem.quantity * updatedItem.rate
                                                      return updatedItem
                                                    }
                                                    return prevItem
                                                  })
                                                })
                                                setItemOpen(prev => ({ ...prev, [item.id]: false }))
                                              }}
                                            >
                                              <div className="flex items-center justify-between">
                                                <span>{displayName} ({motorcycle.sku}) - {priceValue} USD</span>
                                                <span className={cn(
                                                  "text-xs ml-2",
                                                  motorcycle.stockQuantity > 0 ? "text-muted-foreground" : "text-destructive font-medium"
                                                )}>
                                                  {t('stock')}: {motorcycle.stockQuantity}
                                                </span>
                                              </div>
                                            </div>
                                          )
                                        })}
                                    </div>
                                  </div>
                                )}
                                {item.productNotFound && (
                                  <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded">
                                    <IconAlertTriangle className="h-3 w-3" />
                                    <span>{t('itemNotFoundInDatabase', { type: isMotorcycle ? t('motorcycle') : t('product') })}</span>
                                    <Button
                                      variant="link"
                                      size="sm"
                                      className="h-auto p-0 text-xs underline"
                                      onClick={() => {
                                        if (isMotorcycle) {
                                          setMotorcycleDialogData({
                                            name: item.itemName,
                                            price: item.rate,
                                            itemId: item.id
                                          })
                                          setMotorcycleDialogOpen(true)
                                        } else {
                                        setProductDialogData({
                                          name: item.itemName,
                                          price: item.rate,
                                          itemId: item.id
                                        })
                                        setProductDialogOpen(true)
                                        }
                                      }}
                                    >
                                      {t('pressAddToAddIt', { type: isMotorcycle ? t('motorcycle') : t('product') })}
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="align-top">
                              <div className="flex flex-col items-end gap-1">
                                <Input
                                  type="number"
                                  min="0"
                                  max={(() => {
                                    const availableStock = calculateAvailableStock(item)
                                    return availableStock !== undefined ? availableStock : undefined
                                  })()}
                                  value={item.quantity || ''}
                                  onChange={(e) =>
                                    handleUpdateItem(item.id, 'quantity', parseInt(e.target.value) || 0)
                                  }
                                  className={cn(
                                    "w-24 text-right",
                                    (item.quantity === 0 || item.quantity === null || item.quantity === undefined) && "border-destructive focus:border-destructive focus:ring-destructive",
                                    (() => {
                                      const availableStock = calculateAvailableStock(item)
                                      return availableStock !== undefined && item.quantity > availableStock
                                    })() && "border-destructive"
                                  )}
                                />
                                {(() => {
                                  const availableStock = calculateAvailableStock(item)
                                  if (availableStock === undefined || availableStock === null) return null
                                  return (
                                    <div className={cn(
                                      "text-xs text-right w-full",
                                      item.quantity > availableStock ? "text-destructive font-medium" : "text-muted-foreground"
                                    )}>
                                      {item.quantity > availableStock
                                        ? t('exceedsBy', { amount: item.quantity - availableStock })
                                        : `${t('available')}: ${availableStock} ${t('stock')}`}
                                    </div>
                                  )
                                })()}
                              </div>
                            </TableCell>
                            <TableCell className="align-top">
                              <div className="flex flex-col items-end">
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={item.rate}
                                  onChange={(e) =>
                                    handleUpdateItem(item.id, 'rate', parseFloat(e.target.value) || 0)
                                  }
                                  className={cn(
                                    "w-32 text-right",
                                    priceAwareEnabled && item.originalPrice !== undefined && item.originalPrice !== null && item.rate < item.originalPrice && "border-yellow-500 focus:border-yellow-500 focus:ring-yellow-500/50",
                                    priceAwareEnabled && item.originalPrice !== undefined && item.originalPrice !== null && item.rate > item.originalPrice && "border-purple-500 focus:border-purple-500 focus:ring-purple-500/50"
                                  )}
                                />
                              </div>
                            </TableCell>
                            <TableCell className="align-top">
                              <div className="flex flex-col items-end gap-1 pt-1">
                                <div className="font-semibold text-right text-base">
                                  {getCurrencySymbol()}{formatCurrency(item.amount)}
                                </div>
                                {(() => {
                                  const availableStock = calculateAvailableStock(item)
                                  if (availableStock === undefined || availableStock === null) return null
                                  if (item.quantity > availableStock) {
                                    return (
                                      <div className="text-xs text-destructive font-medium text-right">
                                        Exceeds stock!
                                      </div>
                                    )
                                  }
                                  return null
                                })()}
                              </div>
                            </TableCell>
                            <TableCell className="align-top">
                              <div className="flex justify-center">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleRemoveItem(item.id)}
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                >
                                  <IconX className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {items.length > 0 && (
                  <div className="flex justify-between items-center bg-muted/30 rounded-lg px-4 py-3 border">
                    <div className="flex items-center gap-4">
                      <span className={cn("text-sm font-medium", fontClass)}>{t('totalQuantity')}: <span className="font-semibold">{totalQty}</span></span>
                    </div>
                    <div className="text-right">
                      <span className={cn("text-sm text-muted-foreground", fontClass)}>{t('subtotal')} ({getCurrencyLabel()}): </span>
                      <span className="text-lg font-bold">{getCurrencySymbol()}{formatCurrency(total)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Discount Section */}
              {items.length > 0 && (
                <div className="space-y-4 border-t pt-6">
                  <div className="flex items-center justify-between">
                    <h3 className={cn("text-lg font-semibold", fontClass)}>{t('discount')}</h3>
                    <div className="flex items-center space-x-2">
                    <Switch
                      checked={discountEnabled}
                      onCheckedChange={handleDiscountEnabledChange}
                    />
                      <Label className={fontClass}>{t('applyDiscount')}</Label>
                    </div>
                  </div>
                  
                  {discountEnabled && (
                    <div className="grid grid-cols-2 gap-4 bg-muted/30 rounded-lg p-4 border">
                      <div className="space-y-2">
                        <Label className={fontClass}>{t('discountType')}</Label>
                        <Select value={discountType} onValueChange={(value: 'percentage' | 'value') => setDiscountType(value)}>
                          <SelectTrigger className={fontClass}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="percentage" className={fontClass}>{t('percentage')}</SelectItem>
                            <SelectItem value="value" className={fontClass}>{t('fixedAmount')} ({getCurrencyLabel()})</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className={fontClass}>{t('discountAmount')}</Label>
                        <Input
                          type="number"
                          min="0"
                          step={discountType === 'percentage' ? '0.01' : '1'}
                          max={discountType === 'percentage' ? '100' : undefined}
                          value={discountAmount}
                          onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                          placeholder={discountType === 'percentage' ? t('enterPercentage') : t('enterAmount')}
                          className={fontClass}
                        />
                      </div>
                      {discountEnabled && discountAmount > 0 && (
                        <div className="col-span-2 pt-2 border-t">
                          <div className="flex justify-between items-center">
                            <span className={cn("text-sm text-muted-foreground", fontClass)}>{t('discountValue')}:</span>
                            <span className="text-lg font-semibold text-primary">
                              {getCurrencySymbol()}{formatCurrency(discountValue)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Payment Summary - Always Visible */}
              <div className="space-y-6 border-t pt-6">
                <h3 className="text-xl font-bold">{t('paymentSummary')}</h3>
                
                {isWholesale && selectedCustomer ? (
                  /* Wholesale Payment Information - Modern Design */
                  <div className="space-y-4">
                    {/* 1. How Much Customer is Willing to Pay - FIRST */}
                    <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl p-6 border-2 border-primary/20 shadow-sm">
                      <Label htmlFor="payment-amount" className="text-sm font-medium text-muted-foreground mb-2 block">
                        {t('howMuchCustomerWillingToPay')}
                      </Label>
                      <Input
                        id="payment-amount"
                        type="number"
                        min="0"
                        step="0.01"
                        value={totalAdvance === 0 ? '' : totalAdvance}
                        onChange={(e) => {
                          const inputValue = e.target.value
                          // Handle empty input
                          if (inputValue === '' || inputValue === null || inputValue === undefined) {
                            setTotalAdvance(0)
                            return
                          }
                          // Parse the value - this automatically removes leading zeros
                          const numericValue = parseFloat(inputValue)
                          // Only update if it's a valid number
                          if (!isNaN(numericValue) && numericValue >= 0) {
                            // Calculate maximum allowed payment
                            // When editing, customerCurrentDebt already includes the original invoice's amountDue
                            // So we need to subtract it first, then add the new invoice amount
                            const balanceBeforeInvoice = invoiceId 
                              ? customerCurrentDebt - originalInvoiceAmountDue 
                              : customerCurrentDebt
                            // Maximum payment = balance before invoice + grand total (to ensure balance never goes below 0)
                            const maxAllowedPayment = balanceBeforeInvoice + grandTotal
                            
                            // Prevent payment from exceeding maximum (which would make balance negative)
                            if (numericValue > maxAllowedPayment) {
                              toast({
                                title: t('paymentExceedsDebt'),
                                description: locale === 'ku' 
                                  ? `زیاتر لە باڵانسی ئستای کڕیاڕ نابێت بدرێت. کۆی قەرز: ${formatCurrency(balanceBeforeInvoice + grandTotal)}`
                                  : locale === 'ar'
                                  ? `لا يمكن الدفع أكثر من الدين. إجمالي الدين: ${formatCurrency(balanceBeforeInvoice + grandTotal)}`
                                  : `Cannot pay more than debt. Total debt: ${formatCurrency(balanceBeforeInvoice + grandTotal)}`,
                                variant: "destructive",
                              })
                              setTotalAdvance(maxAllowedPayment)
                            } else {
                              setTotalAdvance(numericValue)
                            }
                          }
                        }}
                        onBlur={(e) => {
                          // On blur, ensure empty field shows 0 and validate max payment
                          if (e.target.value === '' || e.target.value === null) {
                            setTotalAdvance(0)
                          } else {
                            const numericValue = parseFloat(e.target.value)
                            if (!isNaN(numericValue)) {
                              const balanceBeforeInvoice = invoiceId 
                                ? customerCurrentDebt - originalInvoiceAmountDue 
                                : customerCurrentDebt
                              const maxAllowedPayment = balanceBeforeInvoice + grandTotal
                              if (numericValue > maxAllowedPayment) {
                                setTotalAdvance(maxAllowedPayment)
                                toast({
                                  title: t('paymentExceedsDebt'),
                                  description: locale === 'ku' 
                                    ? `زیاتر لە باڵانسی ئستای کڕیاڕ نابێت بدرێت. کۆی قەرز: ${formatCurrency(balanceBeforeInvoice + grandTotal)}`
                                    : locale === 'ar'
                                    ? `لا يمكن الدفع أكثر من الدين. إجمالي الدين: ${formatCurrency(balanceBeforeInvoice + grandTotal)}`
                                    : `Cannot pay more than debt. Total debt: ${formatCurrency(balanceBeforeInvoice + grandTotal)}`,
                                  variant: "destructive",
                                })
                              }
                            }
                          }
                        }}
                        placeholder="0"
                        className="text-3xl font-bold h-16 bg-background"
                      />
                    </div>
                    
                    {/* 2. Payment Details Grid */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-card rounded-lg p-4 border shadow-sm">
                        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
                          {t('currentDebt')}
                        </Label>
                        <div className="text-2xl font-bold text-destructive">
                          {(() => {
                            // Use actual invoice type if editing, otherwise use saleType prop
                            const isMotorcycleInvoice = invoiceId ? (actualInvoiceIsMotorcycle ?? isMotorcycle) : isMotorcycle
                            return isMotorcycleInvoice ? getCurrencySymbol() : 'ع.د '
                          })()}{formatCurrency(customerCurrentDebt)}
                        </div>
                      </div>
                      <div className="bg-card rounded-lg p-4 border shadow-sm">
                        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
                          {t('currentBalance')}
                        </Label>
                        <div className={`text-2xl font-bold ${customerCurrentBalance >= 0 ? 'text-destructive' : 'text-green-600'}`}>
                          {(() => {
                            // Use actual invoice type if editing, otherwise use saleType prop
                            const isMotorcycleInvoice = invoiceId ? (actualInvoiceIsMotorcycle ?? isMotorcycle) : isMotorcycle
                            return isMotorcycleInvoice ? getCurrencySymbol() : 'ع.د '
                          })()}{formatCurrency(customerCurrentBalance)}
                        </div>
                      </div>
                    </div>
                    
                    {/* 3. How Much They Paid & Grand Total */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-card rounded-lg p-4 border shadow-sm">
                        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
                          {t('howMuchTheyPaid')}
                        </Label>
                        <div className="text-2xl font-bold text-primary">
                          {getCurrencySymbol()}{formatCurrency(totalAdvance)}
                        </div>
                      </div>
                      <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg p-4 border-2 border-primary/20 shadow-sm">
                        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
                          {t('grandTotal')}
                        </Label>
                        <div className="text-2xl font-bold text-primary">
                          {getCurrencySymbol()}{formatCurrency(grandTotal)}
                        </div>
                      </div>
                    </div>
                    
                    {/* 4. Remaining Balance */}
                    <div className="bg-muted/50 rounded-lg p-4 border">
                      <div className="flex justify-between items-center">
                        <Label className="text-base font-semibold">{t('remainingBalanceAfterInvoice')}</Label>
                        {(() => {
                          // When editing, customerCurrentDebt already includes the original invoice's amountDue
                          // So we need to subtract it first, then add the new invoice amount
                          const balanceBeforeInvoice = invoiceId 
                            ? customerCurrentDebt - originalInvoiceAmountDue 
                            : customerCurrentDebt
                          const newAmountDue = grandTotal - totalAdvance
                          const remainingBalance = balanceBeforeInvoice + newAmountDue
                          // Use actual invoice type if editing, otherwise use saleType prop
                          const isMotorcycleInvoice = invoiceId ? (actualInvoiceIsMotorcycle ?? isMotorcycle) : isMotorcycle
                          return (
                            <div className={`text-2xl font-bold ${remainingBalance >= 0 ? 'text-destructive' : 'text-green-600'}`}>
                              {isMotorcycleInvoice ? getCurrencySymbol() : 'ع.د '}{formatCurrency(remainingBalance)}
                            </div>
                          )
                        })()}
                      </div>
                    </div>
                  </div>
                ) : isWholesale && !selectedCustomer ? (
                  /* Wholesale but no customer selected */
                  <div className="bg-muted/30 rounded-lg p-6 border">
                    <div className="text-center text-muted-foreground">
                      <p className="text-sm">{t('selectCustomerForPayment')}</p>
                      <div className="mt-4">
                        <div className="bg-card rounded-lg p-4 border shadow-sm">
                          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
                            {t('grandTotal')}
                          </Label>
                          <div className="text-2xl font-bold text-primary">
                            {getCurrencySymbol()}{formatCurrency(grandTotal)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Retail Payment - Always Direct Payment */
                  <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-xl p-6 border-2 border-green-200 dark:border-green-800 shadow-sm">
                    <div className="flex justify-between items-center">
                      <div>
                        <Label className={cn("text-sm font-medium text-muted-foreground mb-1 block", fontClass)}>{t('paymentMethod')}</Label>
                        <div className={cn("text-xl font-bold text-green-700 dark:text-green-400", fontClass)}>{t('directPaymentPayNow')}</div>
                      </div>
                      <div className="text-right">
                        <Label className={cn("text-sm font-medium text-muted-foreground mb-1 block", fontClass)}>{t('grandTotal')}</Label>
                        <div className={cn("text-3xl font-bold text-green-700 dark:text-green-400", fontClass)}>
                          {getCurrencySymbol()}{formatCurrency(grandTotal)}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

          </div>
        </Tabs>
      </div>
      
      {/* Product Dialog - Pre-filled with item name and price */}
      {!isMotorcycle && (
      <ProductDialog
        open={productDialogOpen}
        onOpenChange={(open) => {
          setProductDialogOpen(open)
          if (!open) {
            setProductDialogData(null)
          }
        }}
        onSuccess={async () => {
          // Store the item ID and name before closing dialog
          const savedItemId = productDialogData?.itemId
          const savedItemName = productDialogData?.name
          
          // Refresh products list for the item if it exists
          if (savedItemId && savedItemName) {
            await fetchItemProducts(savedItemId, savedItemName)
          }
          
          // Update the item with the newly created product's data (only if opened from an item)
          if (savedItemId && savedItemName) {
            try {
              // Fetch the newly created product by name
              const response = await fetch(`/api/products?search=${encodeURIComponent(savedItemName)}&pageSize=50`)
              const data = await response.json()
              
              // Find the newly created product by exact name match (should be the first match)
              const newProduct = data.products?.find((p: Product) => p.name === savedItemName)
              
              if (newProduct) {
                // Determine which price to use (retail for retail, wholesale for wholesale)
                const price = isRetail ? newProduct.mufradPrice : newProduct.jumlaPrice
                const priceValue = typeof price === 'number' ? price : parseFloat(String(price)) || 0
                
                // Update the item with the new product's data
                setItems(currentItems => currentItems.map(item => {
                  if (item.id === savedItemId) {
                    const updatedItem = {
                      ...item,
                      itemId: newProduct.id,
                      itemName: newProduct.name,
                      stockQuantity: newProduct.stockQuantity || 0,
                      isProductInDatabase: true,
                      productNotFound: false,
                    }
                    // Only update rate if it's 0 or not set, preserve user's manual input
                    if (item.rate === 0 || !item.rate) {
                      updatedItem.rate = priceValue
                      // Recalculate amount
                      updatedItem.amount = updatedItem.quantity * updatedItem.rate
                    }
                    return updatedItem
                  }
                  return item
                }))
              } else {
                // If product not found in search, just mark as in database
                setItems(currentItems => currentItems.map(item => {
                  if (item.id === savedItemId) {
                    return {
                      ...item,
                      isProductInDatabase: true,
                      productNotFound: false,
                    }
                  }
                  return item
                }))
              }
            } catch (error) {
              console.error('Error fetching newly created product:', error)
              // Fallback: just mark as in database
              setItems(currentItems => currentItems.map(item => {
                if (item.id === savedItemId) {
                  return {
                    ...item,
                    isProductInDatabase: true,
                    productNotFound: false,
                  }
                }
                return item
              }))
            }
          }
          setProductDialogOpen(false)
          setProductDialogData(null)
        }}
        categories={categories}
        onCategoriesChange={fetchCategories}
        product={productDialogData ? {
          id: '', // Empty ID = new product
          name: productDialogData.name,
          sku: '', // Will be auto-generated
          mufradPrice: '', // Empty - user must enter price
          jumlaPrice: '', // Empty - user must enter price
          rmbPrice: null,
          stockQuantity: 0,
          lowStockThreshold: 10,
          image: null,
          notes: null,
          attachment: null,
          categoryId: null,
          category: null,
        } : null}
      />
      )}

      {/* Motorcycle Dialog - Pre-filled with item name and price */}
      {isMotorcycle && (
        <MotorcycleDialog
          open={motorcycleDialogOpen}
          onOpenChange={(open) => {
            setMotorcycleDialogOpen(open)
            if (!open) {
              setMotorcycleDialogData(null)
            }
          }}
          onSuccess={async () => {
            // Store the item ID and name before closing dialog
            const savedItemId = motorcycleDialogData?.itemId
            const savedItemName = motorcycleDialogData?.name
            
            // Refresh motorcycles list for the item if it exists
            if (savedItemId && savedItemName) {
              await fetchItemMotorcycles(savedItemId, savedItemName)
            }
            
            // Update the item to mark it as in database (only if opened from an item)
            if (motorcycleDialogData?.itemId) {
              setItems(currentItems => currentItems.map(item => {
                if (item.id === motorcycleDialogData.itemId) {
                  return {
                    ...item,
                    isProductInDatabase: true,
                    productNotFound: false,
                  }
                }
                return item
              }))
            }
            setMotorcycleDialogOpen(false)
            setMotorcycleDialogData(null)
          }}
          categories={motorcycleCategories}
          onCategoriesChange={fetchMotorcycleCategories}
          motorcycle={motorcycleDialogData ? {
            id: '', // Empty ID = new motorcycle
            name: motorcycleDialogData.name,
            sku: '',
            image: null,
            attachment: null,
            usdRetailPrice: motorcycleDialogData.price,
            usdWholesalePrice: motorcycleDialogData.price,
            rmbPrice: null,
            stockQuantity: 0,
            lowStockThreshold: 10,
            status: 'IN_STOCK',
            notes: null,
            categoryId: null,
            category: null,
          } : null}
        />
      )}

      {/* Invoice Success Dialog */}
      <InvoiceSuccessDialog
        open={invoiceSuccessDialog.open}
        onOpenChange={(open) => setInvoiceSuccessDialog({ ...invoiceSuccessDialog, open })}
        invoiceNumber={invoiceSuccessDialog.invoiceNumber}
        invoiceId={invoiceSuccessDialog.invoiceId}
        onCloseTab={onSubmitSuccess}
      />

      {/* Submit Confirmation Dialog */}
      <AlertDialog open={showSubmitConfirm} onOpenChange={setShowSubmitConfirm}>
        <AlertDialogContent 
          className={cn("sm:max-w-md", fontClass)} 
          style={{ direction } as React.CSSProperties}
        >
          <AlertDialogHeader>
            <AlertDialogTitle 
              className={cn(
                "flex items-center gap-2",
                direction === 'rtl' && 'text-right',
                fontClass
              )}
              style={{ direction } as React.CSSProperties}
            >
              <IconAlertTriangle className="h-5 w-5 text-yellow-600" />
              {t('confirmSubmission')}
            </AlertDialogTitle>
            <AlertDialogDescription 
              className={cn(direction === 'rtl' && 'text-right', fontClass)}
              style={{ direction } as React.CSSProperties}
            >
              {t('areYouSureSubmit', { tab: customerName || t('salesInvoice') })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => setShowSubmitConfirm(false)}
              className={cn(fontClass, "bg-gray-500 hover:bg-gray-600")}
            >
              {t('cancel')}
            </AlertDialogAction>
            <AlertDialogAction
              onClick={handleSubmit}
              className={cn(fontClass, "bg-green-600 hover:bg-green-700")}
            >
              {t('submit')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Alert Dialog */}
      <AlertDialog open={alertDialog.open} onOpenChange={(open) => setAlertDialog({ ...alertDialog, open })}>
        <AlertDialogContent 
          className={cn("sm:max-w-md", fontClass)} 
          style={{ direction } as React.CSSProperties}
        >
          <AlertDialogHeader>
            <AlertDialogTitle 
              className={cn(
                "flex items-center gap-2",
                direction === 'rtl' && 'text-right',
                alertDialog.type === 'error' && 'text-destructive',
                alertDialog.type === 'success' && 'text-green-600',
                fontClass
              )}
              style={{ direction } as React.CSSProperties}
            >
              {alertDialog.type === 'error' && <IconAlertTriangle className="h-5 w-5" />}
              {alertDialog.type === 'success' && <IconCircleCheck className="h-5 w-5" />}
              {alertDialog.type === 'info' && <IconAlertTriangle className="h-5 w-5" />}
              {alertDialog.title}
            </AlertDialogTitle>
            <AlertDialogDescription 
              className={cn(direction === 'rtl' && 'text-right', fontClass)}
              style={{ direction } as React.CSSProperties}
            >
              {alertDialog.message}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => setAlertDialog({ ...alertDialog, open: false })}
              className={cn(
                fontClass,
                alertDialog.type === 'error' && 'bg-destructive hover:bg-destructive/90',
                alertDialog.type === 'success' && 'bg-green-600 hover:bg-green-700',
              )}
            >
              {t('ok')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

