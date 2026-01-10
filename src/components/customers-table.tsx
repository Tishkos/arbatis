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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
import { CustomerDialog } from "@/components/customer-dialog"
import { DeleteCustomerDialog } from "@/components/delete-customer-dialog"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

// Customer type based on Prisma schema
type Customer = {
  id: string
  name: string
  sku: string
  phone: string | null
  email: string | null
  image: string | null
  attachment: string | null
  notes: string | null
  notificationDays: number | null
  notificationType: string | null
  debtIqd: number | string
  debtUsd: number | string
  currentBalance: number | string
  daysOverdue: number
  addressId: string | null
  address: {
    id: string
    name: string
  } | null
  createdAt: Date | string
  updatedAt: Date | string
}

type CustomersResponse = {
  customers?: Customer[]
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

const createColumns = (fontClass: string, router: any, locale: string, t: any): ColumnDef<Customer>[] => [
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
          aria-label={t('selectAll')}
        />
      </div>
    ),
    cell: ({ row }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label={t('selectRow')}
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
      const customer = row.original
      const image = customer.image
      const name = customer.name
      const initials = name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)

      return (
        <Avatar 
          className="h-10 w-10 cursor-pointer hover:ring-2 hover:ring-primary transition-all"
          onClick={(e) => {
            e.stopPropagation()
            router.push(`/${locale}/customers/${customer.id}`)
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
      <SortableHeader header={t('columns.code')} column={column} fontClass={fontClass} />
    ),
    size: 120,
    minSize: 100,
    maxSize: 200,
    cell: ({ row }) => {
      const customer = row.original
      return (
        <div
          className={cn("font-mono text-sm cursor-pointer hover:underline transition-all", fontClass)}
          onClick={(e) => {
            e.stopPropagation()
            router.push(`/${locale}/customers/${customer.id}`)
          }}
        >
          {customer.sku}
        </div>
      )
    },
    enableResizing: true,
  },
  {
    accessorKey: "name",
    header: ({ column }) => (
      <SortableHeader header={t('columns.name')} column={column} fontClass={fontClass} />
    ),
    size: 200,
    minSize: 150,
    maxSize: 400,
    cell: ({ row }) => {
      const customer = row.original
      return (
        <div 
          className={cn("font-medium cursor-pointer hover:underline transition-all", fontClass)}
          onClick={(e) => {
            e.stopPropagation()
            router.push(`/${locale}/customers/${customer.id}`)
          }}
        >
          {customer.name}
        </div>
      )
    },
    enableResizing: true,
  },
  {
    accessorKey: "phone",
    header: ({ column }) => (
      <SortableHeader header={t('columns.phone')} column={column} fontClass={fontClass} />
    ),
    size: 130,
    minSize: 110,
    maxSize: 200,
    cell: ({ row }) => {
      const phone = row.original.phone
      return phone ? (
        <div className={cn("text-sm", fontClass)}>{phone}</div>
      ) : (
        <span className={cn("text-muted-foreground", fontClass)}>-</span>
      )
    },
  },
  {
    accessorKey: "address",
    header: ({ column }) => (
      <SortableHeader header={t('columns.address')} column={column} fontClass={fontClass} />
    ),
    size: 180,
    minSize: 150,
    maxSize: 300,
    sortingFn: (rowA, rowB) => {
      const addrA = rowA.original.address?.name || ''
      const addrB = rowB.original.address?.name || ''
      return addrA.localeCompare(addrB)
    },
    cell: ({ row }) => {
      const address = row.original.address
      const addressName = typeof address === 'object' && address !== null ? address.name : (address || null)
      return addressName ? (
        <div className={cn("text-sm", fontClass)}>{addressName}</div>
      ) : (
        <span className={cn("text-muted-foreground", fontClass)}>-</span>
      )
    },
  },
  {
    accessorKey: "debtIqd",
    header: ({ column }) => (
      <div className={cn("text-right flex items-center justify-end", fontClass)}>
        <SortableHeader header={t('columns.debtIqd')} column={column} fontClass={fontClass} />
      </div>
    ),
    size: 130,
    minSize: 110,
    maxSize: 200,
    cell: ({ row }) => {
      const debt = Number(row.original.debtIqd)
      const isOverdue = row.original.daysOverdue > 0 && debt > 0
      return (
        <div className={cn("text-right", fontClass)}>
          {isOverdue && (
            <IconAlertCircle className="h-4 w-4 text-destructive inline-block mr-1" />
          )}
          <span className={cn("font-medium", isOverdue && "text-destructive", fontClass)}>
            {debt.toLocaleString()} ع.د
          </span>
        </div>
      )
    },
  },
  {
    accessorKey: "debtUsd",
    header: ({ column }) => (
      <div className={cn("text-right flex items-center justify-end", fontClass)}>
        <SortableHeader header={t('columns.debtUsd')} column={column} fontClass={fontClass} />
      </div>
    ),
    size: 130,
    minSize: 110,
    maxSize: 200,
    cell: ({ row }) => {
      const debt = Number(row.original.debtUsd)
      const isOverdue = row.original.daysOverdue > 0 && debt > 0
      return (
        <div className={cn("text-right", fontClass)}>
          {isOverdue && (
            <IconAlertCircle className="h-4 w-4 text-destructive inline-block mr-1" />
          )}
          <span className={cn("font-medium", isOverdue && "text-destructive", fontClass)}>
            ${debt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      )
    },
  },
  {
    accessorKey: "daysOverdue",
    header: ({ column }) => (
      <div className={cn("text-right flex items-center justify-end", fontClass)}>
        <SortableHeader header={t('columns.daysOverdue')} column={column} fontClass={fontClass} />
      </div>
    ),
    size: 180,
    minSize: 160,
    maxSize: 250,
    cell: ({ row }) => {
      const days = row.original.daysOverdue
      const hasDebt = Number(row.original.debtIqd) > 0 || Number(row.original.debtUsd) > 0
      if (!hasDebt || days === 0) {
        return <span className={cn("text-muted-foreground", fontClass)}>-</span>
      }
      return (
        <div className={cn("text-right flex items-center justify-end gap-1", fontClass)}>
          <IconAlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
          <Badge variant="destructive" className={cn("text-white bg-destructive", fontClass)}>
            {days} {locale === 'ku' ? 'ڕۆژ' : locale === 'ar' ? 'أيام' : 'days'}
          </Badge>
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
      const meta = table.options.meta as { onEdit?: (customer: Customer) => void; onDelete?: (customer: Customer) => void }
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="data-[state=open]:bg-muted text-muted-foreground flex size-8"
              size="icon"
            >
              <IconDotsVertical />
              <span className="sr-only">{t('openMenu')}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-32">
            <DropdownMenuItem onClick={() => meta.onEdit?.(row.original)} className={fontClass}>
              {t('edit')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => meta.onDelete?.(row.original)}
              className={fontClass}
            >
              {t('deleteAction')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]

export function CustomersTable() {
  const params = useParams()
  const router = useRouter()
  const locale = (params?.locale as string) || 'ku'
  const t = useTranslations('customers')
  const fontClass = locale === 'ku' ? 'font-kurdish' : 'font-engar'
  const direction = getTextDirection(locale as 'ku' | 'en' | 'ar')

  const [data, setData] = React.useState<Customer[]>([])
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState("")
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })
  const [paginationMeta, setPaginationMeta] = React.useState({
    total: 0,
    totalPages: 0,
  })
  const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>({})
  const [rowSelection, setRowSelection] = React.useState({})
  const [addresses, setAddresses] = React.useState<
    { id: string; name: string }[]
  >([])
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false)
  const [selectedCustomer, setSelectedCustomer] = React.useState<Customer | null>(null)

  const sortBy = sorting[0]?.id || 'name'
  const sortOrder = sorting[0]?.desc ? 'desc' : 'asc'

  const fetchCustomers = React.useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(pagination.pageIndex + 1),
        pageSize: String(pagination.pageSize),
        ...(search && { search }),
        sortBy,
        sortOrder,
      })

      const response = await fetch(`/api/customers?${params}`)
      const data: CustomersResponse = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch customers')
      }

      setData(data.customers || [])
      setPaginationMeta({
        total: data.pagination?.total || 0,
        totalPages: data.pagination?.totalPages || 0,
      })
    } catch (error) {
      console.error("Error fetching customers:", error)
    } finally {
      setLoading(false)
    }
  }, [pagination.pageIndex, pagination.pageSize, search, sortBy, sortOrder])

  React.useEffect(() => {
    fetchCustomers()
  }, [fetchCustomers])

  // Fetch addresses
  React.useEffect(() => {
    fetch("/api/addresses")
      .then((res) => res.json())
      .then((data) => {
        if (data.addresses) {
          setAddresses(data.addresses)
        }
      })
      .catch(console.error)
  }, [])

  const columns = React.useMemo(
    () => createColumns(fontClass, router, locale, t),
    [fontClass, router, locale, t]
  )

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      pagination,
      columnSizing,
      rowSelection,
    },
    getRowId: (row) => row.id,
    enableRowSelection: true,
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: setPagination,
    onColumnSizingChange: setColumnSizing,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    pageCount: paginationMeta.totalPages,
    defaultColumn: {
      minSize: 30,
      maxSize: 500,
      size: 150,
    },
    meta: {
      onEdit: (customer: Customer) => {
        setSelectedCustomer(customer)
        setIsDialogOpen(true)
      },
      onDelete: (customer: Customer) => {
        setSelectedCustomer(customer)
        setIsDeleteDialogOpen(true)
      },
    },
  })

  const handleDialogClose = () => {
    setIsDialogOpen(false)
    setSelectedCustomer(null)
    fetchCustomers()
  }

  const handleDeleteDialogClose = () => {
    setIsDeleteDialogOpen(false)
    setSelectedCustomer(null)
    fetchCustomers()
  }

  return (
    <div className={cn("flex flex-col gap-4 px-4 lg:px-6", fontClass)} style={{ direction } as React.CSSProperties}>
      {/* Header with search and filters */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className={cn("text-2xl font-semibold", fontClass)}>{t('title')}</h1>
          <Button
            onClick={() => {
              setSelectedCustomer(null)
              setIsDialogOpen(true)
            }}
            className={fontClass}
          >
            <IconPlus className="mr-2 h-4 w-4" />
            {t('addCustomer')}
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
                  colSpan={columns.length}
                  className={cn("h-24 text-center", fontClass)}
                >
                  <div className="flex items-center justify-center">
                    <Spinner className="h-8 w-8" />
                  </div>
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className={cn("h-24 text-center", fontClass)}
                >
                  {t('noCustomersFound')}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      style={{
                        width: cell.column.getSize() !== 150 ? `${cell.column.getSize()}px` : undefined,
                      }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className={cn("text-muted-foreground hidden flex-1 text-sm lg:flex", fontClass)}>
          {t('pagination.selected', { selected: table.getFilteredSelectedRowModel().rows.length, total: paginationMeta.total })}
        </div>
        <div className="flex w-full items-center gap-8 lg:w-fit">
          <div className="hidden items-center gap-2 lg:flex">
            <Label htmlFor="rows-per-page" className={cn("text-sm font-medium", fontClass)}>
              {t('pagination.rowsPerPage')}
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
            {t('pagination.page')} {table.getState().pagination.pageIndex + 1} {t('pagination.of')} {paginationMeta.totalPages || 1}
          </div>
          <div className="ml-auto flex items-center gap-2 lg:ml-0">
            <Button
              variant="outline"
              className="hidden h-8 w-8 p-0 lg:flex"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">{t('pagination.page')} 1</span>
              <IconChevronsLeft />
            </Button>
            <Button
              variant="outline"
              className="size-8"
              size="icon"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">{t('pagination.page')} {table.getState().pagination.pageIndex}</span>
              <IconChevronLeft />
            </Button>
            <Button
              variant="outline"
              className="size-8"
              size="icon"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">{t('pagination.page')} {table.getState().pagination.pageIndex + 2}</span>
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
              <span className="sr-only">{t('pagination.page')} {paginationMeta.totalPages}</span>
              <IconChevronsRight />
            </Button>
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <CustomerDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSuccess={handleDialogClose}
        addresses={addresses}
        customer={selectedCustomer}
      />

      <DeleteCustomerDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onSuccess={handleDeleteDialogClose}
        customerName={selectedCustomer?.name || ''}
        customerId={selectedCustomer?.id || ''}
      />
    </div>
  )
}

