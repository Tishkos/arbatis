"use client"

import * as React from "react"
import {
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
  IconLayoutColumns,
  IconSearch,
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
import { apiFetch } from "@/lib/api-client"
import { format } from 'date-fns'

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
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
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

// Activity type based on API response
type Activity = {
  id: string
  entityType: 'PRODUCT' | 'MOTORCYCLE'
  entityId: string
  type: string
  description: string
  changes: any
  invoiceId: string | null
  invoiceNumber: string | null
  createdAt: string
  createdBy: {
    id: string
    name: string
    email: string
  } | null
}

type ActivitiesResponse = {
  activities: Activity[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

type User = {
  id: string
  name: string
  email: string
}

// Sortable header component
const SortableHeader = ({ 
  header, 
  column, 
  fontClass 
}: { 
  header: string | React.ReactNode
  column: any
  fontClass: string 
}) => {
  const canSort = column.getCanSort()
  const sortDirection = column.getIsSorted()
  
  if (!canSort) {
    return <>{header}</>
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 cursor-pointer select-none hover:text-primary transition-colors group",
        fontClass
      )}
      onClick={column.getToggleSortingHandler()}
    >
      <span>{header}</span>
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

const createColumns = (fontClass: string, router: any, locale: string, t: any): ColumnDef<Activity>[] => [
  {
    accessorKey: "type",
    header: ({ column }) => (
      <SortableHeader header={t('columnHeaders.type')} column={column} fontClass={fontClass} />
    ),
    size: 150,
    minSize: 120,
    maxSize: 200,
    cell: ({ row }) => {
      const type = row.original.type
      const getTypeColor = (type: string) => {
        if (type.includes('CREATED')) return 'bg-green-500'
        if (type.includes('UPDATED')) return 'bg-blue-500'
        if (type.includes('STOCK')) return 'bg-orange-500'
        if (type.includes('PRICE')) return 'bg-purple-500'
        if (type.includes('ATTACHMENT')) return 'bg-pink-500'
        if (type.includes('DELETED')) return 'bg-red-500'
        if (type.includes('INVOICED')) return 'bg-indigo-500'
        return 'bg-gray-500'
      }
      const getTypeLabel = (type: string) => {
        if (type === 'STOCK_ADDED') return t('stockAdded')
        if (type === 'STOCK_REDUCED') return t('stockReduced')
        if (type === 'STOCK_ADJUSTED') return t('stockAdjusted')
        if (type === 'CREATED') return t('created')
        if (type === 'UPDATED') return t('updated')
        if (type === 'DELETED') return t('deleted')
        if (type === 'PRICE_CHANGED') return t('priceChanged')
        if (type === 'IMAGE_CHANGED') return t('imageChanged')
        if (type === 'ATTACHMENT_ADDED') return t('attachmentAdded')
        if (type === 'ATTACHMENT_REMOVED') return t('attachmentRemoved')
        if (type === 'CATEGORY_CHANGED') return t('categoryChanged')
        if (type === 'INVOICED') return t('invoiced')
        return type.replace(/_/g, ' ')
      }
      return (
        <Badge className={cn("text-white", getTypeColor(type))}>
          {getTypeLabel(type)}
        </Badge>
      )
    },
  },
  {
    accessorKey: "description",
    header: ({ column }) => (
      <SortableHeader header={t('columnHeaders.description')} column={column} fontClass={fontClass} />
    ),
    size: 400,
    minSize: 300,
    maxSize: 600,
    cell: ({ row }) => {
      const activity = row.original
      // Determine where to navigate based on activity type
      const getNavigationPath = () => {
        // If invoice-related, navigate to invoice
        if (activity.invoiceId) {
          return `/${locale}/invoices/${activity.invoiceId}`
        }
        // Otherwise navigate to entity
        return activity.entityType === 'PRODUCT' 
          ? `/${locale}/products/${activity.entityId}`
          : `/${locale}/motorcycles/${activity.entityId}`
      }
      
      return (
        <div 
          className={cn("font-medium cursor-pointer hover:underline transition-all", fontClass)}
          onClick={(e) => {
            e.stopPropagation()
            router.push(getNavigationPath())
          }}
        >
          {activity.description}
        </div>
      )
    },
  },
  {
    accessorKey: "entityType",
    header: ({ column }) => (
      <SortableHeader header={t('columnHeaders.category')} column={column} fontClass={fontClass} />
    ),
    size: 150,
    minSize: 120,
    maxSize: 200,
    cell: ({ row }) => {
      const activity = row.original
      // If activity has invoiceId, it's invoice/sale related
      if (activity.invoiceId) {
        return (
          <Badge className="bg-blue-500 text-white">
            {t('invoiceSale')}
          </Badge>
        )
      }
      // Otherwise show entity type
      const entityType = activity.entityType
      return (
        <Badge variant={entityType === 'PRODUCT' ? 'default' : 'secondary'}>
          {entityType === 'PRODUCT' ? t('product') : t('motorcycle')}
        </Badge>
      )
    },
  },
  {
    accessorKey: "invoiceNumber",
    header: ({ column }) => (
      <SortableHeader header={t('columnHeaders.invoice')} column={column} fontClass={fontClass} />
    ),
    size: 180,
    minSize: 150,
    maxSize: 250,
    cell: ({ row }) => {
      const invoiceNumber = row.original.invoiceNumber
      const invoiceId = row.original.invoiceId
      if (!invoiceNumber) return <span className={cn("text-muted-foreground", fontClass)}>-</span>
      return (
        <div
          className={cn("font-mono text-sm cursor-pointer hover:underline transition-all", fontClass)}
          onClick={(e) => {
            e.stopPropagation()
            if (invoiceId) {
              router.push(`/${locale}/invoices/${invoiceId}`)
            }
          }}
        >
          {invoiceNumber}
        </div>
      )
    },
  },
  {
    accessorKey: "createdBy",
    header: ({ column }) => (
      <SortableHeader header={t('columnHeaders.user')} column={column} fontClass={fontClass} />
    ),
    size: 200,
    minSize: 150,
    maxSize: 300,
    sortingFn: (rowA, rowB) => {
      const nameA = rowA.original.createdBy?.name || ''
      const nameB = rowB.original.createdBy?.name || ''
      return nameA.localeCompare(nameB)
    },
    cell: ({ row }) => {
      const createdBy = row.original.createdBy
      if (!createdBy) return <span className={cn("text-muted-foreground", fontClass)}>-</span>
      const initials = createdBy.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
      return (
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className={cn("text-sm", fontClass)}>
            <div className="font-medium">{createdBy.name}</div>
            <div className="text-xs text-muted-foreground">{createdBy.email}</div>
          </div>
        </div>
      )
    },
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => (
      <SortableHeader header={t('columnHeaders.date')} column={column} fontClass={fontClass} />
    ),
    size: 180,
    minSize: 150,
    maxSize: 250,
    cell: ({ row }) => {
      const activity = row.original
      return (
        <div className={cn("text-sm", fontClass)}>
          {format(new Date(activity.createdAt), 'PPp')}
        </div>
      )
    },
  },
]

export function ActivitiesTable() {
  const params = useParams()
  const router = useRouter()
  const locale = (params?.locale as string) || "en"
  const fontClass = locale === "ku" ? "font-kurdish" : "font-engar"
  const direction = getTextDirection(locale as "ku" | "en" | "ar")
  const t = useTranslations('navigation.activitiesPage')

  const [data, setData] = React.useState<Activity[]>([])
  const [loading, setLoading] = React.useState(true)
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
  const [userId, setUserId] = React.useState<string>("all")
  const [entityType, setEntityType] = React.useState<string>("all")
  const [activityType, setActivityType] = React.useState<string>("all")
  const [users, setUsers] = React.useState<User[]>([])
  const [paginationMeta, setPaginationMeta] = React.useState({
    total: 0,
    totalPages: 0,
  })

  // Fetch users
  React.useEffect(() => {
    apiFetch("/api/users")
      .then((res) => res.json())
      .then((data) => {
        if (data?.users) {
          setUsers(data.users)
        }
      })
      .catch(console.error)
  }, [])

  // Fetch activities
  const fetchActivities = React.useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(pagination.pageIndex + 1),
        pageSize: String(pagination.pageSize),
        ...(search && { search }),
        ...(userId && userId !== 'all' && { userId }),
        ...(entityType && entityType !== 'all' && { entityType }),
        ...(activityType && activityType !== 'all' && { activityType }),
        ...(sorting.length > 0 && {
          sortBy: sorting[0].id,
          sortOrder: sorting[0].desc ? "desc" : "asc",
        }),
      })

      const response = await apiFetch(`/api/activities/all?${params}`)
      const data: ActivitiesResponse = await response.json()

      if (!response.ok || (data as any).error) {
        console.error("Error fetching activities:", (data as any).error || "Unknown error")
        setData([])
        setPaginationMeta({
          total: 0,
          totalPages: 0,
        })
        return
      }

      setData(data.activities || [])
      setPaginationMeta({
        total: data.pagination?.total || 0,
        totalPages: data.pagination?.totalPages || 0,
      })
    } catch (error) {
      console.error("Error fetching activities:", error)
    } finally {
      setLoading(false)
    }
  }, [pagination, search, userId, entityType, activityType, sorting])

  React.useEffect(() => {
    fetchActivities()
  }, [fetchActivities])

  const table = useReactTable({
    data,
    columns: createColumns(fontClass, router, locale, t),
    state: {
      sorting,
      columnVisibility,
      columnFilters,
      pagination,
      columnSizing,
    },
    getRowId: (row) => row.id,
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: setPagination,
    onColumnSizingChange: setColumnSizing,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    pageCount: paginationMeta.totalPages,
  })

  const activityTypes = [
    'CREATED',
    'UPDATED',
    'STOCK_ADDED',
    'STOCK_REDUCED',
    'STOCK_ADJUSTED',
    'PRICE_CHANGED',
    'IMAGE_CHANGED',
    'ATTACHMENT_ADDED',
    'ATTACHMENT_REMOVED',
    'CATEGORY_CHANGED',
    'DELETED',
    'INVOICED',
  ]

  return (
    <div className="space-y-4 p-6" dir={direction}>
      <div className="flex items-center justify-between">
        <h1 className={cn("text-3xl font-bold", fontClass)}>Activities</h1>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <IconSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder={t('searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={cn("pl-10", fontClass)}
            />
          </div>
        </div>

        <Select value={userId} onValueChange={setUserId}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t('allUsers')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allUsers')}</SelectItem>
            {users.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={entityType} onValueChange={setEntityType}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder={t('allEntities')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allEntities')}</SelectItem>
            <SelectItem value="PRODUCT">{t('product')}</SelectItem>
            <SelectItem value="MOTORCYCLE">{t('motorcycle')}</SelectItem>
            <SelectItem value="invoices">{t('invoices')}</SelectItem>
          </SelectContent>
        </Select>

        <Select value={activityType} onValueChange={setActivityType}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t('allTypes')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allTypes')}</SelectItem>
            {activityTypes.map((type) => {
              const getTypeLabel = (type: string) => {
                if (type === 'STOCK_ADDED') return t('stockAdded')
                if (type === 'STOCK_REDUCED') return t('stockReduced')
                if (type === 'STOCK_ADJUSTED') return t('stockAdjusted')
                if (type === 'CREATED') return t('created')
                if (type === 'UPDATED') return t('updated')
                if (type === 'DELETED') return t('deleted')
                if (type === 'PRICE_CHANGED') return t('priceChanged')
                if (type === 'IMAGE_CHANGED') return t('imageChanged')
                if (type === 'ATTACHMENT_ADDED') return t('attachmentAdded')
                if (type === 'ATTACHMENT_REMOVED') return t('attachmentRemoved')
                if (type === 'CATEGORY_CHANGED') return t('categoryChanged')
                if (type === 'INVOICED') return t('invoiced')
                return type.replace(/_/g, ' ')
              }
              return (
                <SelectItem key={type} value={type}>
                  {getTypeLabel(type)}
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="ml-auto">
              <IconLayoutColumns className="mr-2 h-4 w-4" />
              {t('columns')}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {table
              .getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => {
                const getColumnLabel = (columnId: string) => {
                  const labelMap: Record<string, string> = {
                    'type': t('columnHeaders.type'),
                    'description': t('columnHeaders.description'),
                    'entityType': t('columnHeaders.category'),
                    'invoiceNumber': t('columnHeaders.invoice'),
                    'createdBy': t('columnHeaders.user'),
                    'createdAt': t('columnHeaders.date'),
                  }
                  return labelMap[columnId] || columnId
                }
                return (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className={fontClass}
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) =>
                      column.toggleVisibility(!!value)
                    }
                  >
                    {getColumnLabel(column.id)}
                  </DropdownMenuCheckboxItem>
                )
              })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Spinner />
          </div>
        ) : (
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      style={{ width: header.getSize() }}
                      className="relative"
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
                            "absolute right-0 top-0 h-full w-1 cursor-col-resize touch-none select-none bg-border hover:bg-primary/50 opacity-0 hover:opacity-100 transition-opacity",
                            header.column.getIsResizing() && "opacity-100 bg-primary"
                          )}
                        />
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => {
                      const activity = row.original
                      // Navigate to invoice if invoice-related, otherwise to entity
                      const path = activity.invoiceId
                        ? `/${locale}/invoices/${activity.invoiceId}`
                        : activity.entityType === 'PRODUCT' 
                          ? `/${locale}/products/${activity.entityId}`
                          : `/${locale}/motorcycles/${activity.entityId}`
                      router.push(path)
                    }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        style={{ width: cell.column.getSize() }}
                        className={fontClass}
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
                    className="h-24 text-center"
                  >
                    {t('noActivitiesFound')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className={cn("text-sm text-muted-foreground", fontClass)}>
          {t('pagination.total', { total: paginationMeta.total })}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
          >
            <IconChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <IconChevronLeft className="h-4 w-4" />
          </Button>
          <div className={cn("text-sm font-medium", fontClass)}>
            {t('pagination.page')} {pagination.pageIndex + 1} {t('pagination.of')} {paginationMeta.totalPages || 1}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <IconChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
          >
            <IconChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

