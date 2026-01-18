"use client"

import * as React from "react"
import {
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
  IconDotsVertical,
  IconPlus,
  IconSearch,
  IconPrinter,
  IconAlertCircle,
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
import { Label } from "@/components/ui/label"
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
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog-animated"
import { MotorcycleDialog } from "@/components/motorcycle-dialog"
import { DeleteMotorcycleDialog } from "@/components/delete-motorcycle-dialog"
import { PrintMotorcyclesDialog } from "@/components/print-motorcycles-dialog"
import { Spinner } from "@/components/ui/spinner"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

// Motorcycle type based on Prisma schema
type Motorcycle = {
  id: string
  name: string
  sku: string
  image: string | null
  attachment: string | null
  usdRetailPrice: number | string
  usdWholesalePrice: number | string
  rmbPrice: number | string | null
  stockQuantity: number
  lowStockThreshold: number
  status: "IN_STOCK" | "RESERVED" | "SOLD" | "OUT_OF_STOCK"
  notes: string | null
  categoryId: string | null
  category: {
    id: string
    name: string
  } | null
  createdAt: Date | string
  updatedAt: Date | string
}

type MotorcyclesResponse = {
  motorcycles?: Motorcycle[]
  pagination?: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
  error?: string
}

// Sortable header component
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

const createColumns = (fontClass: string, router: any, locale: string, t: any): ColumnDef<Motorcycle>[] => [
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
          aria-label={t('actions.selectAll')}
        />
      </div>
    ),
    cell: ({ row }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label={t('actions.selectRow')}
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
    accessorKey: "image",
    header: t('columns.image'),
    size: 80,
    minSize: 60,
    maxSize: 120,
    cell: ({ row }) => {
      const motorcycle = row.original
      const image = motorcycle.image
      const name = motorcycle.name
      const initials = name
        ? name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2)
        : 'MC'

      return (
        <Avatar 
          className="h-10 w-10 cursor-pointer hover:ring-2 hover:ring-primary transition-all"
          onClick={(e) => {
            e.stopPropagation()
            router.push(`/${locale}/motorcycles/${motorcycle.id}`)
          }}
        >
          <AvatarImage src={image || undefined} alt={name} />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
      )
    },
    enableSorting: false,
  },
  {
    accessorKey: "id",
    header: ({ column }) => (
      <SortableHeader header={t('columns.id')} column={column} fontClass={fontClass} />
    ),
    size: 100,
    minSize: 80,
    maxSize: 150,
    cell: ({ row }) => (
      <div className={cn("font-mono text-xs text-muted-foreground", fontClass)}>
        {row.original.id.slice(0, 8)}...
      </div>
    ),
  },
  {
    accessorKey: "sku",
    header: ({ column }) => (
      <SortableHeader header={t('columns.sku')} column={column} fontClass={fontClass} />
    ),
    size: 120,
    minSize: 100,
    maxSize: 200,
    cell: ({ row }) => {
      const motorcycle = row.original
      return (
        <div
          className={cn("font-mono text-sm cursor-pointer hover:underline transition-all", fontClass)}
          onClick={(e) => {
            e.stopPropagation()
            router.push(`/${locale}/motorcycles/${motorcycle.id}`)
          }}
        >
          {motorcycle.sku}
        </div>
      )
    },
    enableResizing: true,
  },
  {
    accessorKey: "name",
    header: ({ column }) => (
      <SortableHeader header={locale === "ku" ? "ناو" : locale === "ar" ? "الاسم" : "Name"} column={column} fontClass={fontClass} />
    ),
    size: 200,
    minSize: 150,
    maxSize: 300,
    cell: ({ row }) => {
      const motorcycle = row.original
      return (
        <div 
          className={cn("font-medium cursor-pointer hover:underline transition-all", fontClass)}
          onClick={(e) => {
            e.stopPropagation()
            router.push(`/${locale}/motorcycles/${motorcycle.id}`)
          }}
        >
          {motorcycle.name}
        </div>
      )
    },
    enableResizing: true,
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => (
      <SortableHeader header={t('columns.dateOfEntry')} column={column} fontClass={fontClass} />
    ),
    size: 150,
    minSize: 120,
    maxSize: 200,
    cell: ({ row }) => {
      const motorcycle = row.original
      return (
        <div
          className={cn("text-sm cursor-pointer hover:underline transition-all", fontClass)}
          onClick={(e) => {
            e.stopPropagation()
            router.push(`/${locale}/motorcycles/${motorcycle.id}`)
          }}
        >
          {format(new Date(motorcycle.createdAt), 'PP')}
        </div>
      )
    },
    enableResizing: true,
  },
  {
    accessorKey: "category",
    header: ({ column }) => (
      <SortableHeader 
        header={t("columns.category")} 
        column={column} 
        fontClass={fontClass} 
      />
    ),
    size: 150,
    minSize: 120,
    maxSize: 250,
    sortingFn: (rowA, rowB) => {
      const catA = rowA.original.category?.name || ''
      const catB = rowB.original.category?.name || ''
      return catA.localeCompare(catB)
    },
    cell: ({ row }) => {
      const category = row.original.category
      if (!category) return <span className={cn("text-muted-foreground", fontClass)}>-</span>
      return <Badge variant="outline" className={fontClass}>{category.name}</Badge>
    },
  },
  {
    accessorKey: "usdRetailPrice",
    header: ({ column }) => (
      <div className={cn("text-right flex items-center justify-end", fontClass)}>
        <SortableHeader header={t('columns.retailPrice')} column={column} fontClass={fontClass} />
      </div>
    ),
    size: 130,
    minSize: 110,
    maxSize: 200,
    cell: ({ row }) => {
      const price = Number(row.original.usdRetailPrice)
      return (
        <div className={cn("text-right font-medium", fontClass)}>
          ${price.toLocaleString()}
        </div>
      )
    },
  },
  {
    accessorKey: "usdWholesalePrice",
    header: ({ column }) => (
      <div className={cn("text-right flex items-center justify-end", fontClass)}>
        <SortableHeader header={t('columns.wholesalePrice')} column={column} fontClass={fontClass} />
      </div>
    ),
    size: 140,
    minSize: 120,
    maxSize: 200,
    cell: ({ row }) => {
      const price = Number(row.original.usdWholesalePrice)
      return (
        <div className={cn("text-right font-medium", fontClass)}>
          ${price.toLocaleString()}
        </div>
      )
    },
  },
  {
    accessorKey: "stockQuantity",
    header: ({ column }) => (
      <div className={cn("text-right flex items-center justify-end", fontClass)}>
        <SortableHeader header={t('columns.quantity')} column={column} fontClass={fontClass} />
      </div>
    ),
    size: 100,
    minSize: 80,
    maxSize: 150,
    cell: ({ row }) => {
      const quantity = row.original.stockQuantity
      const threshold = row.original.lowStockThreshold
      // Only show low stock alert if threshold > 0 (enabled)
      const isLowStock = threshold > 0 && quantity <= threshold

      return (
        <div className="flex items-center justify-end gap-2">
          {isLowStock && (
            <IconAlertCircle className="h-4 w-4 text-destructive" />
          )}
          <span className={cn("font-medium", isLowStock && "text-destructive", fontClass)}>
            {quantity}
          </span>
        </div>
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
      const meta = table.options.meta as { onEdit?: (motorcycle: Motorcycle) => void; onDelete?: (motorcycle: Motorcycle) => void }
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
              <span className="sr-only">{t('actions.openMenu')}</span>
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
                meta.onEdit?.(row.original)
              }}
            >
              {t('actions.edit')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              variant="destructive"
              onClick={(e) => {
                e.stopPropagation()
                meta.onDelete?.(row.original)
              }}
            >
              {t('actions.delete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]

export function MotorcyclesTable() {
  const params = useParams()
  const router = useRouter()
  const locale = (params?.locale as string) || "ku"
  const t = useTranslations("motorcycles")
  const fontClass = locale === "ku" ? "font-kurdish" : "font-engar"
  const direction = getTextDirection(locale as "ku" | "en" | "ar")

  const [data, setData] = React.useState<Motorcycle[]>([])
  const [loading, setLoading] = React.useState(true)
  const [rowSelection, setRowSelection] = React.useState({})
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({})
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  )
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>({})
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })

  // Search and filter states
  const [search, setSearch] = React.useState("")
  const [categoryFilter, setCategoryFilter] = React.useState<string>("")
  const [lowStockFilter, setLowStockFilter] = React.useState<boolean>(false)
  const [paginationMeta, setPaginationMeta] = React.useState({
    total: 0,
    totalPages: 0,
  })
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false)
  const [editingMotorcycle, setEditingMotorcycle] = React.useState<Motorcycle | null>(null)
  const [deletingMotorcycle, setDeletingMotorcycle] = React.useState<Motorcycle | null>(null)
  const [isPrintDialogOpen, setIsPrintDialogOpen] = React.useState(false)
  const [categories, setCategories] = React.useState<
    { id: string; name: string }[]
  >([])

  // Fetch motorcycle categories function
  const fetchCategories = React.useCallback(async () => {
    try {
      const response = await fetch("/api/motorcycle-categories")
      const data = await response.json()
      if (data.categories) {
        setCategories(data.categories)
      }
    } catch (error) {
      console.error('Error fetching motorcycle categories:', error)
    }
  }, [])

  // Fetch categories on mount
  React.useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  // Memoize sorting values to prevent infinite loops
  const sortBy = React.useMemo(() => sorting.length > 0 ? sorting[0].id : null, [sorting])
  const sortOrder = React.useMemo(() => sorting.length > 0 ? (sorting[0].desc ? "desc" : "asc") : null, [sorting])

  // Fetch motorcycles
  const fetchMotorcycles = React.useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(pagination.pageIndex + 1),
        pageSize: String(pagination.pageSize),
        ...(search && { search }),
        ...(categoryFilter && { categoryId: categoryFilter }),
        ...(lowStockFilter && { lowStock: 'true' }),
        ...(sortBy && sortOrder && {
          sortBy,
          sortOrder,
        }),
      })

      const response = await fetch(`/api/motorcycles?${params}`)
      const data: MotorcyclesResponse = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch motorcycles')
      }

      setData(data.motorcycles || [])
      setPaginationMeta({
        total: data.pagination?.total || 0,
        totalPages: data.pagination?.totalPages || 0,
      })
    } catch (error) {
      console.error("Error fetching motorcycles:", error)
    } finally {
      setLoading(false)
    }
  }, [pagination.pageIndex, pagination.pageSize, search, categoryFilter, lowStockFilter, sortBy, sortOrder])

  React.useEffect(() => {
    fetchMotorcycles()
  }, [fetchMotorcycles])


  const table = useReactTable({
    data,
    columns: createColumns(fontClass, router, locale, t),
    meta: {
      onEdit: (motorcycle: Motorcycle) => {
        setEditingMotorcycle(motorcycle)
      },
      onDelete: (motorcycle: Motorcycle) => {
        setDeletingMotorcycle(motorcycle)
      },
    },
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
          <Button onClick={() => setIsAddDialogOpen(true)} className={fontClass}>
            <IconPlus className="mr-2 h-4 w-4" />
            {t('addMotorcycle')}
          </Button>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center w-full">
          <div className="relative flex-1">
            <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t('searchPlaceholder')}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPagination((prev) => ({ ...prev, pageIndex: 0 }))
              }}
              className={cn("pl-9", fontClass)}
            />
          </div>

          <Select
            value={categoryFilter || "all"}
            onValueChange={(value) => {
              setCategoryFilter(value === "all" ? "" : value)
              setPagination((prev) => ({ ...prev, pageIndex: 0 }))
            }}
          >
            <SelectTrigger className={cn("w-full sm:w-[200px]", fontClass)}>
              <SelectValue placeholder={t("allCategories")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allCategories")}</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant={lowStockFilter ? "default" : "outline"}
            onClick={() => {
              setLowStockFilter(!lowStockFilter)
              setPagination((prev) => ({ ...prev, pageIndex: 0 }))
            }}
            className={cn("w-full sm:w-auto whitespace-nowrap", fontClass)}
          >
            <IconAlertCircle className={cn("mr-2 h-4 w-4", lowStockFilter && "animate-pulse")} />
            {t('lowStock')}
          </Button>

          <Button
            variant="outline"
            onClick={() => setIsPrintDialogOpen(true)}
            className={cn("w-full sm:w-auto whitespace-nowrap", fontClass)}
          >
            <IconPrinter className="mr-2 h-4 w-4" />
            {t('print.print')}
          </Button>
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
            ) : table.getRowModel().rows?.length ? (
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
                    router.push(`/${locale}/motorcycles/${row.original.id}`)
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
                  colSpan={createColumns(fontClass, router, locale, t).length}
                  className={cn("h-24 text-center", fontClass)}
                >
                  {t('noMotorcycles')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
          <div className={cn("text-muted-foreground hidden flex-1 text-sm lg:flex", fontClass)}>
          {t('selected', { count: table.getFilteredSelectedRowModel().rows.length, total: paginationMeta.total })}
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
                <SelectTrigger size="sm" className="w-20" id="rows-per-page">
                  <SelectValue
                    placeholder={table.getState().pagination.pageSize}
                  />
                </SelectTrigger>
                <SelectContent side="top">
                  {[10, 20, 50, 100].map((pageSize) => (
                    <SelectItem key={pageSize} value={`${pageSize}`}>
                      {pageSize}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className={cn("flex w-fit items-center justify-center text-sm font-medium", fontClass)}>
            {t('page', { current: table.getState().pagination.pageIndex + 1, total: paginationMeta.totalPages || 1 })}
          </div>
          <div className="ml-auto flex items-center gap-2 lg:ml-0">
            <Button
              variant="outline"
              className="hidden h-8 w-8 p-0 lg:flex"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">{t('pagination.goToFirst')}</span>
              <IconChevronsLeft />
            </Button>
            <Button
              variant="outline"
              className="size-8"
              size="icon"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">{t('pagination.goToPrevious')}</span>
              <IconChevronLeft />
            </Button>
            <Button
              variant="outline"
              className="size-8"
              size="icon"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">{t('pagination.goToNext')}</span>
              <IconChevronRight />
            </Button>
            <Button
              variant="outline"
              className="hidden size-8 lg:flex"
              size="icon"
              onClick={() =>
                table.setPageIndex(paginationMeta.totalPages - 1)
              }
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">{t('pagination.goToLast')}</span>
              <IconChevronsRight />
            </Button>
          </div>
        </div>
      </div>


      {/* Dialogs */}
      <MotorcycleDialog
        open={isAddDialogOpen || !!editingMotorcycle}
        onOpenChange={(open) => {
          if (!open) {
            setIsAddDialogOpen(false)
            setEditingMotorcycle(null)
          }
        }}
        onSuccess={() => {
          setIsAddDialogOpen(false)
          setEditingMotorcycle(null)
          fetchMotorcycles()
        }}
        categories={categories}
        motorcycle={editingMotorcycle ? {
          ...editingMotorcycle,
          status: editingMotorcycle.status || ('IN_STOCK' as const)
        } : null}
        onCategoriesChange={fetchCategories}
      />

      <DeleteMotorcycleDialog
        open={!!deletingMotorcycle}
        onOpenChange={(open) => {
          if (!open) setDeletingMotorcycle(null)
        }}
        onSuccess={() => {
          fetchMotorcycles()
          setDeletingMotorcycle(null)
        }}
        motorcycleName={deletingMotorcycle ? deletingMotorcycle.name : ''}
        motorcycleId={deletingMotorcycle?.id || ''}
      />

      {/* Print Motorcycles Dialog */}
      <PrintMotorcyclesDialog
        open={isPrintDialogOpen}
        onOpenChange={setIsPrintDialogOpen}
        currentPageMotorcycles={data.map(m => ({
          ...m,
          status: typeof m.status === 'string' ? m.status : 'IN_STOCK',
          // Backward compatibility: map name to brand/model for print dialog
          brand: m.name || '',
          model: '',
          year: null,
          engineSize: null,
          vin: null,
          color: null,
        }))}
        currentPageCount={data.length}
        totalCount={paginationMeta.total}
      />
    </div>
  )
}

