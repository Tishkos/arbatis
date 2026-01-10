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
  IconDotsVertical,
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
import { useSession } from "next-auth/react"
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
import { Spinner } from "@/components/ui/spinner"
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
import { cn } from "@/lib/utils"

// User type based on API response
type User = {
  id: string
  name: string
  email: string
  image: string | null
  role: string
  status: string
  createdAt: string | Date
}

type UsersResponse = {
  users: User[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
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

const createColumns = (
  fontClass: string, 
  router: any, 
  locale: string,
  isAdmin: boolean,
  onRoleChange: (user: User, newRole: string) => void,
  t: any
): ColumnDef<User>[] => [
  {
    accessorKey: "image",
    header: t('columnHeaders.profile'),
    size: 80,
    minSize: 60,
    maxSize: 120,
    cell: ({ row }) => {
      const user = row.original
      const initials = user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)

      return (
        <Avatar className="h-10 w-10">
          <AvatarImage src={user.image || undefined} alt={user.name} />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
      )
    },
    enableSorting: false,
  },
  {
    accessorKey: "name",
    header: ({ column }) => (
      <SortableHeader header={t('columnHeaders.name')} column={column} fontClass={fontClass} />
    ),
    size: 200,
    minSize: 150,
    maxSize: 400,
    cell: ({ row }) => {
      const user = row.original
      return (
        <div className={cn("font-medium", fontClass)}>
          {user.name}
        </div>
      )
    },
  },
  {
    accessorKey: "email",
    header: ({ column }) => (
      <SortableHeader header={t('columnHeaders.email')} column={column} fontClass={fontClass} />
    ),
    size: 250,
    minSize: 200,
    maxSize: 400,
    cell: ({ row }) => {
      const user = row.original
      return (
        <div className={cn("text-sm text-muted-foreground", fontClass)}>
          {user.email}
        </div>
      )
    },
  },
  {
    accessorKey: "role",
    header: ({ column }) => (
      <SortableHeader header={t('columnHeaders.role')} column={column} fontClass={fontClass} />
    ),
    size: 150,
    minSize: 120,
    maxSize: 200,
    cell: ({ row }) => {
      const user = row.original
      const getRoleColor = (role: string) => {
        switch (role) {
          case 'ADMIN':
          case 'DEVELOPER':
            return 'bg-purple-500'
          case 'EMPLOYEE':
            return 'bg-blue-500'
          case 'CASHIER':
            return 'bg-green-500'
          case 'VIEWER':
            return 'bg-gray-500'
          default:
            return 'bg-gray-500'
        }
      }
      return (
        <Badge className={cn("text-white", getRoleColor(user.role))}>
          {user.role === 'ADMIN' ? t('admin') : user.role}
        </Badge>
      )
    },
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <SortableHeader header={t('columnHeaders.status')} column={column} fontClass={fontClass} />
    ),
    size: 120,
    minSize: 100,
    maxSize: 150,
    cell: ({ row }) => {
      const status = row.original.status
      const getStatusColor = (status: string) => {
        switch (status) {
          case 'ACTIVE':
            return 'bg-green-500'
          case 'PENDING':
            return 'bg-yellow-500'
          case 'SUSPENDED':
            return 'bg-red-500'
          default:
            return 'bg-gray-500'
        }
      }
      return (
        <Badge className={cn("text-white", getStatusColor(status))}>
          {status === 'ACTIVE' ? t('active') : status === 'INACTIVE' ? t('inactive') : status}
        </Badge>
      )
    },
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => (
      <SortableHeader header={t('columnHeaders.joined')} column={column} fontClass={fontClass} />
    ),
    size: 180,
    minSize: 150,
    maxSize: 250,
    cell: ({ row }) => {
      const user = row.original
      return (
        <div className={cn("text-sm", fontClass)}>
          {format(new Date(user.createdAt), 'PP')}
        </div>
      )
    },
  },
  ...(isAdmin ? [{
    id: "actions",
    enableResizing: false,
    size: 60,
    minSize: 60,
    maxSize: 60,
    cell: ({ row, table }) => {
      const user = row.original
      const meta = table.options.meta as { onRoleChange?: (user: User, newRole: string) => void }
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
            className="w-48"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={cn("px-2 py-1.5 text-sm font-semibold", fontClass)}>{t('changeRole')}</div>
            <DropdownMenuSeparator />
            {['DEVELOPER', 'ADMIN', 'EMPLOYEE', 'CASHIER', 'VIEWER'].map((role) => {
              const getRoleLabel = (role: string) => {
                const roleMap: Record<string, string> = {
                  'DEVELOPER': t('roles.developer'),
                  'ADMIN': t('roles.admin'),
                  'EMPLOYEE': t('roles.employee'),
                  'CASHIER': t('roles.cashier'),
                  'VIEWER': t('roles.viewer'),
                }
                return roleMap[role] || role
              }
              return (
                <DropdownMenuItem
                  key={role}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (user.role !== role) {
                      meta.onRoleChange?.(user, role)
                    }
                  }}
                  className={cn(user.role === role ? 'bg-muted' : '', fontClass)}
                >
                  {getRoleLabel(role)}
                  {user.role === role && ' ✓'}
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  } as ColumnDef<User>] : []),
]

export function EmployeesTable() {
  const params = useParams()
  const router = useRouter()
  const { data: session } = useSession()
  const locale = (params?.locale as string) || "en"
  const fontClass = locale === "ku" ? "font-kurdish" : "font-engar"
  const direction = getTextDirection(locale as "ku" | "en" | "ar")
  const t = useTranslations('navigation.employeesPage')

  const [data, setData] = React.useState<User[]>([])
  const [loading, setLoading] = React.useState(true)
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>({})
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })

  // Search state
  const [search, setSearch] = React.useState("")
  const [paginationMeta, setPaginationMeta] = React.useState({
    total: 0,
    totalPages: 0,
  })

  // Role change dialog
  const [roleChangeDialog, setRoleChangeDialog] = React.useState<{
    open: boolean
    user: User | null
    newRole: string
  }>({
    open: false,
    user: null,
    newRole: '',
  })

  // Check if current user is admin
  const isAdmin = session?.user?.email === 'admin@arb-groups.com' || 
                  (session?.user as any)?.role === 'ADMIN'

  // Fetch users
  const fetchUsers = React.useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(pagination.pageIndex + 1),
        pageSize: String(pagination.pageSize),
        ...(search && { search }),
        ...(sorting.length > 0 && {
          sortBy: sorting[0].id,
          sortOrder: sorting[0].desc ? "desc" : "asc",
        }),
      })

      const response = await apiFetch(`/api/users?${params}`)
      const data: UsersResponse = await response.json()

      if (!response.ok || (data as any).error) {
        console.error("Error fetching users:", (data as any).error || "Unknown error")
        setData([])
        setPaginationMeta({
          total: 0,
          totalPages: 0,
        })
        return
      }

      setData(data.users || [])
      setPaginationMeta({
        total: data.pagination?.total || 0,
        totalPages: data.pagination?.totalPages || 0,
      })
    } catch (error) {
      console.error("Error fetching users:", error)
    } finally {
      setLoading(false)
    }
  }, [pagination, search, sorting])

  React.useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  // Handle role change
  const handleRoleChange = async (user: User, newRole: string) => {
    try {
      const response = await apiFetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })

      if (!response.ok) {
        const error = await response.json()
        alert(`Failed to update role: ${error.error || 'Unknown error'}`)
        return
      }

      // Refresh the table
      await fetchUsers()
      setRoleChangeDialog({ open: false, user: null, newRole: '' })
    } catch (error) {
      console.error('Error updating role:', error)
      alert('Failed to update role. Please try again.')
    }
  }

  const table = useReactTable({
    data,
    columns: createColumns(fontClass, router, locale, isAdmin, (user: User, newRole: string) => {
      setRoleChangeDialog({ open: true, user, newRole })
    }, t),
    meta: {
      onRoleChange: (user: User, newRole: string) => {
        setRoleChangeDialog({ open: true, user, newRole })
      },
    },
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

  return (
    <div className="flex flex-col gap-4 px-4 lg:px-6">
      {/* Header with search */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className={cn("text-2xl font-semibold", fontClass)}>{t('title')}</h1>
        </div>

        {/* Search */}
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
                      'image': t('columnHeaders.profile'),
                      'name': t('columnHeaders.name'),
                      'email': t('columnHeaders.email'),
                      'role': t('columnHeaders.role'),
                      'status': t('columnHeaders.status'),
                      'createdAt': t('columnHeaders.joined'),
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
                  className="hover:bg-muted/50"
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
                  {t('noEmployeesFound')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className={cn("text-muted-foreground hidden flex-1 text-sm lg:flex", fontClass)}>
          {paginationMeta.total} {paginationMeta.total === 1 ? t('employee') : t('employees')} {t('of')} {paginationMeta.total}
        </div>
        <div className="flex w-full items-center gap-8 lg:w-fit">
          <div className="hidden items-center gap-2 lg:flex">
            <Label htmlFor="rows-per-page" className={cn("text-sm font-medium", fontClass)}>
              {t('pagination.rowsPerPage')}
            </Label>
            <Select
              value={`${pagination.pageSize}`}
              onValueChange={(value) => {
                setPagination((prev) => ({
                  ...prev,
                  pageSize: Number(value),
                  pageIndex: 0,
                }))
              }}
            >
              <SelectTrigger id="rows-per-page" className="h-8 w-[70px]">
                <SelectValue placeholder={pagination.pageSize} />
              </SelectTrigger>
              <SelectContent side="top">
                {[10, 20, 30, 40, 50].map((pageSize) => (
                  <SelectItem key={pageSize} value={`${pageSize}`}>
                    {pageSize}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className={cn("flex items-center justify-center text-sm font-medium", fontClass)}>
            {t('pagination.page')} {pagination.pageIndex + 1} {t('pagination.of')} {paginationMeta.totalPages || 1}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="hidden h-8 w-8 p-0 lg:flex"
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
              className="hidden h-8 w-8 p-0 lg:flex"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
            >
              <IconChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Role Change Confirmation Dialog */}
      <AlertDialog open={roleChangeDialog.open} onOpenChange={(open) => 
        setRoleChangeDialog({ ...roleChangeDialog, open })
      }>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change User Role</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to change {roleChangeDialog.user?.name}'s role from{' '}
              <strong>{roleChangeDialog.user?.role}</strong> to{' '}
              <strong>{roleChangeDialog.newRole}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (roleChangeDialog.user) {
                  handleRoleChange(roleChangeDialog.user, roleChangeDialog.newRole)
                }
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

