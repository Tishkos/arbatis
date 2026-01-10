"use client"

import * as React from "react"
import {
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
  IconDotsVertical,
  IconLayoutColumns,
  IconSearch,
  IconEdit,
  IconEye,
  IconFileInvoice,
  IconArrowUp,
  IconArrowDown,
} from "@tabler/icons-react"
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
  type PaginationState,
  type ColumnSizingState,
} from "@tanstack/react-table"
import { useParams, useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { getTextDirection } from "@/lib/i18n"
import { format } from 'date-fns'

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Label } from "@/components/ui/label"

type Invoice = {
  id: string
  invoiceNumber: string
  status: string
  total: number
  amountPaid: number
  amountDue: number
  invoiceDate: string
  dueDate: string | null
  paidAt: string | null
  notes: string | null // Invoice notes field (contains invoice type info)
  customer: {
    id: string
    name: string
    sku: string
  } | null
  createdBy: {
    id: string
    name: string
    email: string
  } | null
  sale: {
    type: string
  } | null
  items: Array<{
    id: string
    productId: string | null
    quantity: number
    unitPrice: number
    discount: number
    taxRate: number
    lineTotal: number
    notes: string | null
    order: number
    product: {
      id: string
      name: string
      sku: string
    } | null
  }>
}

type InvoicesResponse = {
  invoices: Invoice[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
  error?: string
}

const SortableHeader = ({ 
  header, 
  column, 
  fontClass 
}: { 
  header: string | React.ReactNode | ((props: any) => React.ReactNode)
  column: any
  fontClass: string 
}) => {
  const canSort = column.getCanSort()
  const sortDirection = column.getIsSorted()
  
  const headerContent = typeof header === 'function' ? header({ column }) : header
  
  if (!canSort) {
    return <>{headerContent}</>
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 cursor-pointer select-none hover:text-primary transition-colors group",
        fontClass
      )}
      onClick={column.getToggleSortingHandler()}
    >
      <span>{headerContent}</span>
      <div className="flex flex-col items-center justify-center">
        {sortDirection === 'asc' ? (
          <IconArrowUp className="h-3.5 w-3.5 text-primary" />
        ) : sortDirection === 'desc' ? (
          <IconArrowDown className="h-3.5 w-3.5 text-primary" />
        ) : (
          <div className="flex flex-col opacity-30 group-hover:opacity-60 transition-opacity">
            <IconArrowUp className="h-2 w-2 -mb-0.5" />
            <IconArrowDown className="h-2 w-2" />
          </div>
        )}
      </div>
    </div>
  )
}

// Helper function to determine if an invoice is for motorcycles
const isMotorcycleInvoice = (invoice: Invoice): boolean => {
  // Method 1: Check invoice notes for invoice type (most reliable)
  // Format: [INVOICE_TYPE:wholesale-motorcycle] or [INVOICE_TYPE:retail-motorcycle]
  if (invoice.notes) {
    const notes = invoice.notes.toUpperCase()
    if (notes.includes('[INVOICE_TYPE:') && notes.includes('MOTORCYCLE')) {
      return true
    }
  }
  
  // Method 2: Check invoice items for motorcycle markers
  if (invoice.items && invoice.items.length > 0) {
    const hasMotorcycle = invoice.items.some((item: any) => {
      // Primary check: If productId is null and notes exist, check if it's a motorcycle
      // Motorcycles are stored with productId: null and notes starting with "MOTORCYCLE:"
      if (!item.productId && item.notes) {
        const notes = item.notes.toUpperCase().trim()
        if (notes.startsWith('MOTORCYCLE:')) {
          return true
        }
      }
      
      // Secondary check: Check product name (for backward compatibility)
      const productName = item.product?.name?.toLowerCase() || ''
      const itemNotes = item.notes?.toLowerCase() || ''
      if (productName.includes('motorcycle') || itemNotes.startsWith('motorcycle:')) {
        return true
      }
      
      return false
    })
    
    if (hasMotorcycle) {
      return true
    }
  }
  
  // Method 3: If no items or notes, default to false (assume product/IQD)
  return false
}

// Helper function to determine if an invoice is a payment invoice
const isPaymentInvoice = (invoice: Invoice): boolean => {
  // Payment invoices have notes like "Payment invoice - CASH" or "Payment: CASH"
  if (invoice.notes) {
    const notes = invoice.notes.toUpperCase()
    if (notes.includes('PAYMENT') || notes.includes('PAYMENT INVOICE')) {
      return true
    }
  }
  
  // Check invoice items for payment markers
  if (invoice.items && invoice.items.length > 0) {
    const hasPayment = invoice.items.some((item: any) => {
      if (item.notes) {
        const notes = item.notes.toUpperCase().trim()
        if (notes.startsWith('PAYMENT:')) {
          return true
        }
      }
      return false
    })
    
    if (hasPayment) {
      return true
    }
  }
  
  return false
}

const createColumns = (fontClass: string, router: any, locale: string, t: any): ColumnDef<Invoice>[] => [
  {
    id: "select",
    header: ({ table }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      </div>
    ),
    cell: ({ row }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
    enableResizing: false,
    size: 50,
    minSize: 50,
    maxSize: 50,
  },
  {
    id: "icon",
    header: t('invoiceNumber'),
    size: 80,
    minSize: 60,
    maxSize: 120,
    cell: ({ row }) => {
      const invoice = row.original
      return (
        <Avatar 
          className="h-10 w-10 cursor-pointer hover:ring-2 hover:ring-primary transition-all"
          onClick={(e) => {
            e.stopPropagation()
            router.push(`/${locale}/invoices/${invoice.id}`)
          }}
        >
          <AvatarFallback className="bg-blue-100 text-blue-800">
            <IconFileInvoice className="h-5 w-5" />
          </AvatarFallback>
        </Avatar>
      )
    },
    enableSorting: false,
  },
  {
    accessorKey: "invoiceNumber",
    header: ({ column }) => (
      <SortableHeader header={t('invoiceNumber')} column={column} fontClass={fontClass} />
    ),
    size: 180,
    minSize: 150,
    maxSize: 250,
    cell: ({ row }) => {
      const invoice = row.original
      return (
        <div 
          className={cn("font-medium cursor-pointer hover:underline transition-all font-mono", fontClass)}
          onClick={(e) => {
            e.stopPropagation()
            router.push(`/${locale}/invoices/${invoice.id}`)
          }}
        >
          {invoice.invoiceNumber}
        </div>
      )
    },
  },
  {
    accessorKey: "customer",
    header: ({ column }) => (
      <SortableHeader header={t('customer')} column={column} fontClass={fontClass} />
    ),
    size: 200,
    minSize: 150,
    maxSize: 300,
    cell: ({ row }) => {
      const invoice = row.original
      const customer = invoice.customer
      
      // Extract customer name from invoice number for retail invoices (format: customerName-YYYY-MM-DD-RANDOMCODE)
      let displayName = customer ? `${customer.name} (${customer.sku})` : null
      
      if (!displayName && invoice.invoiceNumber) {
        const parts = invoice.invoiceNumber.split('-')
        // Find the first part that looks like a year (4 digits starting with 19 or 20)
        const yearIndex = parts.findIndex(part => /^(19|20)\d{2}$/.test(part))
        if (yearIndex > 0) {
          // Take all parts before the year
          displayName = parts.slice(0, yearIndex).join('-')
        }
      }
      
      return (
        <div 
          className={cn("text-sm cursor-pointer hover:underline transition-all", fontClass)}
          onClick={(e) => {
            e.stopPropagation()
            if (customer) {
              router.push(`/${locale}/customers/${customer.id}`)
            }
          }}
        >
          {displayName || 'Unknown'}
        </div>
      )
    },
    sortingFn: (rowA, rowB) => {
      // Get customer name from database or extract from invoice number
      let nameA = rowA.original.customer?.name || ''
      let nameB = rowB.original.customer?.name || ''
      
      // If no customer name, try to extract from invoice number
      if (!nameA && rowA.original.invoiceNumber) {
        const parts = rowA.original.invoiceNumber.split('-')
        // Find the first part that looks like a year (4 digits starting with 19 or 20)
        const yearIndex = parts.findIndex(part => /^(19|20)\d{2}$/.test(part))
        if (yearIndex > 0) {
          // Take all parts before the year
          nameA = parts.slice(0, yearIndex).join('-')
        }
      }
      
      if (!nameB && rowB.original.invoiceNumber) {
        const parts = rowB.original.invoiceNumber.split('-')
        // Find the first part that looks like a year (4 digits starting with 19 or 20)
        const yearIndex = parts.findIndex(part => /^(19|20)\d{2}$/.test(part))
        if (yearIndex > 0) {
          // Take all parts before the year
          nameB = parts.slice(0, yearIndex).join('-')
        }
      }
      
      return nameA.localeCompare(nameB)
    },
  },
  {
    accessorKey: "type",
    header: ({ column }) => (
      <SortableHeader header={t('type')} column={column} fontClass={fontClass} />
    ),
    size: 160,
    minSize: 140,
    maxSize: 220,
    cell: ({ row }) => {
      const invoice = row.original
      const isWholesale = invoice.sale?.type === 'JUMLA'
      const isRetail = invoice.sale?.type === 'MUFRAD'
      // Check if it's a motorcycle by looking at items
      const isMotorcycle = isMotorcycleInvoice(invoice)
      // Check if it's a payment invoice
      const isPayment = isPaymentInvoice(invoice)
      const currency = isMotorcycle ? 'USD' : 'IQD'
      
      let typeLabel = ''
      if (isPayment) {
        typeLabel = t('typePayment')
      } else if (isWholesale && isMotorcycle) {
        typeLabel = t('typeWholesaleMotorcycle')
      } else if (isWholesale) {
        typeLabel = t('typeWholesaleProduct')
      } else if (isRetail && isMotorcycle) {
        typeLabel = t('typeRetailMotorcycle')
      } else if (isRetail) {
        typeLabel = t('typeRetailProduct')
      } else {
        // Fallback: try to determine from invoice data
        if (invoice.sale?.type) {
          typeLabel = invoice.sale.type === 'JUMLA' ? t('typeWholesaleProduct') : t('typeRetailProduct')
        } else {
          typeLabel = t('typeUnknown')
        }
      }
      
      return (
        <div className={cn("text-sm font-medium", fontClass)}>
          <div className="flex items-center gap-2">
            <span>{typeLabel}</span>
            <Badge 
              variant="outline" 
              className={cn(
                isMotorcycle 
                  ? "bg-blue-50 text-blue-700 border-blue-200" 
                  : "bg-green-50 text-green-700 border-green-200",
                "text-xs font-mono"
              )}
            >
              {currency}
            </Badge>
          </div>
        </div>
      )
    },
  },
  {
    accessorKey: "invoiceDate",
    header: ({ column }) => (
      <SortableHeader header={t('date')} column={column} fontClass={fontClass} />
    ),
    size: 150,
    minSize: 120,
    maxSize: 200,
    cell: ({ row }) => {
      const invoice = row.original
      return (
        <div 
          className={cn("text-sm cursor-pointer hover:underline transition-all", fontClass)}
          onClick={(e) => {
            e.stopPropagation()
            router.push(`/${locale}/invoices/${invoice.id}`)
          }}
        >
          {format(new Date(invoice.invoiceDate), 'PPp')}
        </div>
      )
    },
  },
  {
    accessorKey: "total",
    header: ({ column }) => (
      <div className={cn("text-center", fontClass)}>
        <SortableHeader header={t('total')} column={column} fontClass={fontClass} />
      </div>
    ),
    size: 130,
    minSize: 110,
    maxSize: 200,
    cell: ({ row }) => {
      const invoice = row.original
      // Check if it's a motorcycle invoice
      // Products (wholesale or retail) = IQD, Motorcycles (wholesale or retail) = USD
      const isMotorcycle = isMotorcycleInvoice(invoice)
      const currencySymbol = isMotorcycle ? '$' : 'ع.د '
      
      return (
        <div className={cn("text-center font-semibold", fontClass)}>
          {currencySymbol}{invoice.total.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
        </div>
      )
    },
  },
  {
    accessorKey: "amountPaid",
    header: ({ column }) => (
      <div className={cn("text-center", fontClass)}>
        <SortableHeader header={t('paid')} column={column} fontClass={fontClass} />
      </div>
    ),
    size: 130,
    minSize: 110,
    maxSize: 200,
    cell: ({ row }) => {
      const invoice = row.original
      // Check if it's a motorcycle invoice
      // Products (wholesale or retail) = IQD, Motorcycles (wholesale or retail) = USD
      const isMotorcycle = isMotorcycleInvoice(invoice)
      const currencySymbol = isMotorcycle ? '$' : 'ع.د '
      
      return (
        <div className={cn("text-center font-medium", fontClass)}>
          {currencySymbol}{invoice.amountPaid.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
        </div>
      )
    },
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <SortableHeader header={t('status')} column={column} fontClass={fontClass} />
    ),
    size: 140,
    minSize: 120,
    maxSize: 180,
    cell: ({ row }) => {
      const invoice = row.original
      // If amountPaid is 0 and amountDue > 0, show "Unpaid" instead of "Partially Paid"
      const effectiveStatus = (invoice.amountPaid === 0 && invoice.amountDue > 0) 
        ? 'UNPAID' 
        : invoice.status
      
      const statusColors: Record<string, string> = {
        DRAFT: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100',
        FINALIZED: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
        PAID: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
        PARTIALLY_PAID: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100',
        OVERDUE: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
        CANCELLED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
        UNPAID: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
      }
      const statusLabels: Record<string, string> = {
        DRAFT: t('statusDraft'),
        FINALIZED: t('statusFinalized'),
        PAID: t('statusPaid'),
        PARTIALLY_PAID: t('statusPartiallyPaid'),
        OVERDUE: t('statusOverdue'),
        CANCELLED: t('statusCancelled'),
        UNPAID: t('statusUnpaid'),
      }
      return (
        <Badge className={cn(statusColors[effectiveStatus] || 'bg-gray-100 text-gray-800', fontClass)}>
          {statusLabels[effectiveStatus] || effectiveStatus.replace('_', ' ')}
        </Badge>
      )
    },
  },
  {
    id: "actions",
    enableResizing: false,
    size: 60,
    minSize: 60,
    maxSize: 60,
    cell: ({ row, table }) => {
      const invoice = row.original
      const meta = table.options.meta as { onEdit?: (invoice: Invoice) => void; onView?: (invoice: Invoice) => void }
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="data-[state=open]:bg-muted text-muted-foreground flex size-8"
              size="icon"
              onClick={(e) => e.stopPropagation()}
            >
              <IconDotsVertical />
              <span className="sr-only">{t('openMenu')}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            align="end" 
            className="w-32"
            onClick={(e) => e.stopPropagation()}
          >
            <DropdownMenuItem 
              onClick={(e) => {
                e.stopPropagation()
                router.push(`/${locale}/invoices/${invoice.id}`)
              }}
            >
              <IconEye className="mr-2 h-4 w-4" />
              {t('view')}
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={(e) => {
                e.stopPropagation()
                router.push(`/${locale}/invoices/${invoice.id}/edit`)
              }}
            >
              <IconEdit className="mr-2 h-4 w-4" />
              {t('edit')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]

export function InvoicesTable() {
  const params = useParams()
  const router = useRouter()
  const locale = (params?.locale as string) || "ku"
  const t = useTranslations("navigation.invoicesPage")
  const fontClass = locale === "ku" ? "font-kurdish" : "font-engar"
  const direction = getTextDirection(locale as "ku" | "en" | "ar")

  const [data, setData] = React.useState<Invoice[]>([])
  const [loading, setLoading] = React.useState(true)
  const [rowSelection, setRowSelection] = React.useState({})
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>({})
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })

  // Search and filter states
  const [search, setSearch] = React.useState("")
  const [searchFocused, setSearchFocused] = React.useState(false)
  const [typeFilter, setTypeFilter] = React.useState<string>("")
  const [paginationMeta, setPaginationMeta] = React.useState({
    total: 0,
    totalPages: 0,
  })

  // Fetch invoices
  const fetchInvoices = React.useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(pagination.pageIndex + 1),
        pageSize: String(pagination.pageSize),
        ...(search && { search }),
        ...(typeFilter && { type: typeFilter }),
        ...(sorting.length > 0 && {
          sortBy: sorting[0].id,
          sortOrder: sorting[0].desc ? "desc" : "asc",
        }),
      })

      const response = await fetch(`/api/invoices?${params}`)
      const data: InvoicesResponse = await response.json()

      if (!response.ok || data.error) {
        console.error("Error fetching invoices:", data.error || "Unknown error")
        setData([])
        setPaginationMeta({
          total: 0,
          totalPages: 0,
        })
        return
      }

      setData(data.invoices || [])
      setPaginationMeta({
        total: data.pagination?.total || 0,
        totalPages: data.pagination?.totalPages || 0,
      })
    } catch (error) {
      console.error("Error fetching invoices:", error)
      setData([])
      setPaginationMeta({
        total: 0,
        totalPages: 0,
      })
    } finally {
      setLoading(false)
    }
  }, [pagination, search, typeFilter, sorting])

  React.useEffect(() => {
    fetchInvoices()
  }, [fetchInvoices])

  const table = useReactTable({
    data,
    columns: createColumns(fontClass, router, locale, t),
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
      pagination,
      columnSizing,
    },
    getRowId: (row) => row.id,
    enableRowSelection: true,
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnSizingChange: setColumnSizing,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    pageCount: paginationMeta.totalPages,
  })

  return (
    <div className="flex flex-col gap-4 px-4 lg:px-6">
      {/* Header with search and filters */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className={cn("text-2xl font-semibold", fontClass)}>{t('title')}</h1>
        </div>

        {/* Search and Filters */}
        <div className={cn(
          "flex flex-col gap-4 sm:flex-row sm:items-center w-full transition-all duration-300",
          searchFocused && "sm:justify-center"
        )}>
          <div className={cn(
            "relative transition-all duration-300",
            searchFocused 
              ? "flex-1 max-w-2xl w-full" 
              : "flex-1"
          )}>
            <IconSearch className={cn(
              "absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors duration-200",
              searchFocused ? "text-primary" : "text-muted-foreground"
            )} />
            <Input
              placeholder={t('searchPlaceholder')}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPagination({ ...pagination, pageIndex: 0 })
              }}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              className={cn(
                "pl-9 transition-all duration-300",
                searchFocused 
                  ? "ring-2 ring-primary ring-offset-2 shadow-lg border-primary" 
                  : "border-input",
                fontClass
              )}
            />
          </div>
          
          <div className="flex items-center gap-2">
            <div suppressHydrationWarning>
              <Select value={typeFilter || "all"} onValueChange={(value) => setTypeFilter(value === "all" ? "" : value)}>
                <SelectTrigger className={cn("w-[200px]", fontClass)}>
                  <SelectValue placeholder={t('allTypes') || 'All Types'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('allTypes') || 'All Types'}</SelectItem>
                  <SelectItem value="PAYMENT">{t('typePayment')}</SelectItem>
                  <SelectItem value="WHOLESALE_PRODUCT">{t('typeWholesaleProduct')}</SelectItem>
                  <SelectItem value="WHOLESALE_MOTORCYCLE">{t('typeWholesaleMotorcycle')}</SelectItem>
                  <SelectItem value="RETAIL_PRODUCT">{t('typeRetailProduct')}</SelectItem>
                  <SelectItem value="RETAIL_MOTORCYCLE">{t('typeRetailMotorcycle')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className={fontClass}>
                  <IconLayoutColumns className="mr-2 h-4 w-4" />
                  {t('columns')}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className={fontClass}>
                {table
                  .getAllColumns()
                  .filter((column) => column.getCanHide())
                  .map((column) => {
                    // Map column IDs to translated labels
                    const columnLabels: Record<string, string> = {
                      'invoiceNumber': t('invoiceNumber'),
                      'customer': t('customer'),
                      'type': t('type'),
                      'invoiceDate': t('date'),
                      'total': t('total'),
                      'amountPaid': t('paid'),
                      'status': t('status'),
                    }
                    return (
                      <DropdownMenuCheckboxItem
                        key={column.id}
                        className="capitalize"
                        checked={column.getIsVisible()}
                        onCheckedChange={(value) =>
                          column.toggleVisibility(!!value)
                        }
                      >
                        {columnLabels[column.id] || column.id}
                      </DropdownMenuCheckboxItem>
                    )
                  })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader className="bg-muted sticky top-0 z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead 
                    key={header.id} 
                    colSpan={header.colSpan}
                    style={{ 
                      width: header.getSize() !== 150 ? `${header.getSize()}px` : undefined,
                      position: 'relative',
                      minWidth: header.column.columnDef.minSize ? `${header.column.columnDef.minSize}px` : '50px',
                      maxWidth: header.column.columnDef.maxSize ? `${header.column.columnDef.maxSize}px` : undefined,
                    }}
                    className="select-none"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                    {header.column.getCanResize() && (
                      <div
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        className={cn(
                          "absolute right-0 top-0 h-full w-1 cursor-col-resize touch-none select-none bg-transparent hover:bg-primary/50 transition-colors z-10",
                          header.column.getIsResizing() && "bg-primary"
                        )}
                        style={{
                          transform: header.column.getIsResizing()
                            ? `translateX(${table.getState().columnSizingInfo.deltaOffset ?? 0}px)`
                            : undefined,
                        }}
                      />
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={table.getAllColumns().length}
                  className={cn("h-24 text-center", fontClass)}
                >
                  <div className="flex items-center justify-center">
                    <Spinner className="h-6 w-6" />
                  </div>
                </TableCell>
              </TableRow>
            ) : table.getRowModel()?.rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={(e) => {
                    // Don't navigate if clicking on checkbox, actions, dropdown menu, or links
                    const target = e.target as HTMLElement
                    if (
                      target.closest('button') ||
                      target.closest('[role="checkbox"]') ||
                      target.closest('[data-action-menu]') ||
                      target.closest('[role="menuitem"]') ||
                      target.closest('[data-radix-popper-content-wrapper]') ||
                      target.closest('[data-radix-dropdown-menu-content]')
                    ) {
                      return
                    }
                    router.push(`/${locale}/invoices/${row.original.id}`)
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell 
                      key={cell.id}
                      style={{ 
                        width: cell.column.getSize() !== 150 ? `${cell.column.getSize()}px` : undefined
                      }}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={table.getAllColumns().length}
                  className={cn("h-24 text-center", fontClass)}
                >
                  {t('noInvoices')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className={cn("text-muted-foreground hidden flex-1 text-sm lg:flex", fontClass)}>
          {table.getFilteredSelectedRowModel().rows.length} {t('of')} {paginationMeta.total} {t('selectedCount', { count: paginationMeta.total })}
        </div>
        <div className="flex w-full items-center gap-8 lg:w-fit">
          <div className="hidden items-center gap-2 lg:flex">
            <Label htmlFor="rows-per-page" className={cn("text-sm font-medium", fontClass)}>
              {t('rowsPerPage')}
            </Label>
            <div suppressHydrationWarning>
              <Select
                value={`${table.getState().pagination.pageSize}`}
                onValueChange={(value) => {
                  table.setPageSize(Number(value))
                }}
              >
                <SelectTrigger id="rows-per-page" className="h-8 w-[70px]">
                  <SelectValue placeholder={table.getState().pagination.pageSize} />
                </SelectTrigger>
                <SelectContent side="top">
                  {[10, 20, 30, 50, 100].map((pageSize) => (
                    <SelectItem key={pageSize} value={`${pageSize}`}>
                      {pageSize}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className={cn("flex items-center gap-2 text-sm font-medium", fontClass)}>
            {t('page')} {table.getState().pagination.pageIndex + 1} {t('of')} {table.getPageCount()}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              <IconChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <IconChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <IconChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
            >
              <IconChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

