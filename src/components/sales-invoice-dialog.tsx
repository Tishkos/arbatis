"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import { getTextDirection } from "@/lib/i18n"
import { format } from "date-fns"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { cn } from "@/lib/utils"
import { IconPlus, IconX, IconCheck, IconChevronDown } from "@tabler/icons-react"
import { debounce } from "@/lib/utils"

interface SalesInvoiceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  saleType: "wholesale-product" | "retail-product" | "wholesale-motorcycle" | "retail-motorcycle"
  locale: string
  onSuccess?: () => void
}

interface InvoiceItem {
  id: string
  itemId: string | null
  itemName: string
  itemType: "product" | "motorcycle"
  quantity: number
  rate: number
  amount: number
}

interface Customer {
  id: string
  name: string
  sku: string
  phone?: string
  email?: string
}

interface Product {
  id: string
  name: string
  sku: string
  mufradPrice: number
  jumlaPrice: number
  stockQuantity: number
}

interface Motorcycle {
  id: string
  brand: string
  model: string
  sku: string
  usdRetailPrice: number
  usdWholesalePrice: number
  stockQuantity: number
}

export function SalesInvoiceDialog({ open, onOpenChange, saleType, locale, onSuccess }: SalesInvoiceDialogProps) {
  const params = useParams()
  const fontClass = locale === 'ku' ? 'font-kurdish' : 'font-engar'
  const direction = getTextDirection(locale as 'ku' | 'en' | 'ar')
  
  const isWholesale = saleType.includes('wholesale')
  const isProduct = saleType.includes('product')
  const isMotorcycle = saleType.includes('motorcycle')

  // State
  const [draftId, setDraftId] = React.useState<string | null>(null)
  const [isSaving, setIsSaving] = React.useState(false)
  const [isSaved, setIsSaved] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState("details")
  
  // Details Tab
  const currentYear = new Date().getFullYear()
  const [namingSeries, setNamingSeries] = React.useState(`ACC-SINV-${currentYear}-`)
  const [customerId, setCustomerId] = React.useState<string>("")
  const [customerSearch, setCustomerSearch] = React.useState("")
  const [customerOpen, setCustomerOpen] = React.useState(false)
  const [customers, setCustomers] = React.useState<Customer[]>([])
  const [selectedCustomer, setSelectedCustomer] = React.useState<Customer | null>(null)
  const [date, setDate] = React.useState(format(new Date(), 'yyyy-MM-dd'))
  const [postingTime, setPostingTime] = React.useState(format(new Date(), 'HH:mm:ss'))
  const [postingDate, setPostingDate] = React.useState(format(new Date(), 'yyyy-MM-dd'))
  const [dueDate, setDueDate] = React.useState("")
  const [isPos, setIsPos] = React.useState(false)
  const [isReturn, setIsReturn] = React.useState(false)
  const [isDebitNote, setIsDebitNote] = React.useState(false)
  const [updateStock, setUpdateStock] = React.useState(true)
  
  // Items
  const [items, setItems] = React.useState<InvoiceItem[]>([])
  const [itemSearch, setItemSearch] = React.useState("")
  const [itemOpen, setItemOpen] = React.useState(false)
  const [products, setProducts] = React.useState<Product[]>([])
  const [motorcycles, setMotorcycles] = React.useState<Motorcycle[]>([])
  
  // Taxes
  const [taxCategory, setTaxCategory] = React.useState("")
  const [taxesAndCharges, setTaxesAndCharges] = React.useState("")
  const [shippingRule, setShippingRule] = React.useState("")
  const [incoterm, setIncoterm] = React.useState("")
  
  // Totals
  const [totalQty, setTotalQty] = React.useState(0)
  const [total, setTotal] = React.useState(0)
  const [totalTaxes, setTotalTaxes] = React.useState(0)
  const [grandTotal, setGrandTotal] = React.useState(0)
  const [roundingAdjustment, setRoundingAdjustment] = React.useState(0)
  const [roundedTotal, setRoundedTotal] = React.useState(0)
  const [totalAdvance, setTotalAdvance] = React.useState(0)
  const [outstandingAmount, setOutstandingAmount] = React.useState(0)

  // Fetch customers
  React.useEffect(() => {
    if (customerOpen) {
      fetchCustomers()
    }
  }, [customerOpen, customerSearch])

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

  // Fetch products or motorcycles
  React.useEffect(() => {
    if (itemOpen) {
      if (isProduct) {
        fetchProducts()
      } else {
        fetchMotorcycles()
      }
    }
  }, [itemOpen, itemSearch, isProduct])

  const fetchProducts = async () => {
    try {
      const response = await fetch(`/api/products?search=${encodeURIComponent(itemSearch)}&pageSize=50`)
      const data = await response.json()
      if (data.products) {
        setProducts(data.products)
      }
    } catch (error) {
      console.error('Error fetching products:', error)
    }
  }

  const fetchMotorcycles = async () => {
    try {
      const response = await fetch(`/api/motorcycles?search=${encodeURIComponent(itemSearch)}&pageSize=50`)
      const data = await response.json()
      if (data.motorcycles) {
        setMotorcycles(data.motorcycles)
      }
    } catch (error) {
      console.error('Error fetching motorcycles:', error)
    }
  }

  // Calculate totals
  React.useEffect(() => {
    const qty = items.reduce((sum, item) => sum + item.quantity, 0)
    const subtotal = items.reduce((sum, item) => sum + item.amount, 0)
    const taxes = 0 // TODO: Calculate taxes
    const grand = subtotal + taxes
    const rounded = Math.round(grand)
    const rounding = rounded - grand
    const outstanding = grand - totalAdvance

    setTotalQty(qty)
    setTotal(subtotal)
    setTotalTaxes(taxes)
    setGrandTotal(grand)
    setRoundingAdjustment(rounding)
    setRoundedTotal(rounded)
    setOutstandingAmount(outstanding)
  }, [items, totalAdvance])

  // Auto-save draft
  const autoSaveDraft = React.useCallback(
    debounce(async (data: any) => {
      try {
        const url = draftId ? `/api/drafts/${draftId}` : '/api/drafts'
        const method = draftId ? 'PUT' : 'POST'
        
        const response = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
        
        const result = await response.json()
        if (result.draft?.id && !draftId) {
          setDraftId(result.draft.id)
        }
        setIsSaved(true)
        setTimeout(() => setIsSaved(false), 2000)
      } catch (error) {
        console.error('Error auto-saving draft:', error)
      }
    }, 1000),
    [draftId]
  )

  // Auto-save when data changes
  React.useEffect(() => {
    if (open && (items.length > 0 || customerId || items.length === 0)) {
      const draftData = {
        type: isWholesale ? 'JUMLA' : 'MUFRAD',
        customerId: customerId || null,
        items: items.map((item, index) => ({
          productId: item.itemType === 'product' ? item.itemId : null,
          quantity: item.quantity,
          unitPrice: item.rate,
          lineTotal: item.amount,
          order: index,
          notes: item.itemType === 'motorcycle' ? `MOTORCYCLE:${item.itemId}` : undefined,
        })),
        subtotal: total,
        taxAmount: totalTaxes,
        total: grandTotal,
        notes: '',
      }
      autoSaveDraft(draftData)
    }
  }, [items, customerId, total, totalTaxes, grandTotal, open, autoSaveDraft, isWholesale])

  // Add item
  const handleAddItem = (item: Product | Motorcycle) => {
    const isProductItem = 'mufradPrice' in item
    const price = isProductItem
      ? (isWholesale ? item.jumlaPrice : item.mufradPrice)
      : (isWholesale ? item.usdWholesalePrice : item.usdRetailPrice)
    
    const newItem: InvoiceItem = {
      id: `item-${Date.now()}`,
      itemId: item.id,
      itemName: isProductItem ? item.name : `${item.brand} ${item.model}`,
      itemType: isProductItem ? 'product' : 'motorcycle',
      quantity: 1,
      rate: Number(price),
      amount: Number(price),
    }
    
    setItems([...items, newItem])
    setItemOpen(false)
    setItemSearch("")
  }

  // Update item
  const handleUpdateItem = (id: string, field: 'quantity' | 'rate', value: number) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value }
        updated.amount = updated.quantity * updated.rate
        return updated
      }
      return item
    }))
  }

  // Remove item
  const handleRemoveItem = (id: string) => {
    setItems(items.filter(item => item.id !== id))
  }

  // Handle save
  const handleSave = async () => {
    if (isWholesale && !customerId) {
      alert('Customer is required for wholesale sales')
      return
    }

    setIsSaving(true)
    try {
      const draftData = {
        type: isWholesale ? 'JUMLA' : 'MUFRAD',
        customerId: customerId || null,
        items: items.map((item, index) => ({
          productId: item.itemType === 'product' ? item.itemId : null,
          quantity: item.quantity,
          unitPrice: item.rate,
          lineTotal: item.amount,
          order: index,
          notes: item.itemType === 'motorcycle' ? `MOTORCYCLE:${item.itemId}` : undefined,
        })),
        subtotal: total,
        taxAmount: totalTaxes,
        total: grandTotal,
        notes: '',
      }

      const url = draftId ? `/api/drafts/${draftId}` : '/api/drafts'
      const method = draftId ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draftData),
      })
      
      const result = await response.json()
      if (result.draft?.id && !draftId) {
        setDraftId(result.draft.id)
      }
      setIsSaved(true)
      setTimeout(() => setIsSaved(false), 2000)
    } catch (error) {
      console.error('Error saving draft:', error)
      alert('Error saving draft')
    } finally {
      setIsSaving(false)
    }
  }

  // Reset on close
  React.useEffect(() => {
    if (!open) {
      setItems([])
      setCustomerId("")
      setSelectedCustomer(null)
      setDraftId(null)
      setIsSaved(false)
      setActiveTab("details")
    }
  }, [open])

  React.useEffect(() => {
    if (open) {
      console.log('SalesInvoiceDialog opened', { saleType, isWholesale, isProduct, isMotorcycle })
    }
  }, [open, saleType, isWholesale, isProduct, isMotorcycle])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-w-6xl h-[90vh] flex flex-col p-0", fontClass)} dir={direction}>
        <DialogHeader className="flex-shrink-0 p-6 pb-4">
          <div className="flex items-center justify-between">
            <DialogTitle>
              New Sales Invoice {isSaved && <Badge variant="outline" className="ml-2">Saved</Badge>}
            </DialogTitle>
            <div className="flex items-center gap-2">
              {draftId && (
                <Badge variant="secondary" className="text-xs">
                  Not Saved
                </Badge>
              )}
              <Button
                onClick={handleSave}
                disabled={isSaving}
                size="sm"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="flex-shrink-0 mb-4">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="address">Address & Contact</TabsTrigger>
            <TabsTrigger value="terms">Terms</TabsTrigger>
            <TabsTrigger value="more">More Info</TabsTrigger>
            <TabsTrigger value="series">Series</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto p-4 min-h-0">
            <TabsContent value="details" className="space-y-6 mt-0">
              {/* Series */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Series</Label>
                  <Input
                    value={namingSeries}
                    onChange={(e) => setNamingSeries(e.target.value)}
                    placeholder="ACC-SINV-.YYYY.-"
                  />
                </div>
              </div>

              {/* Customer */}
              <div className="space-y-2">
                <Label>
                  Customer {isWholesale && <span className="text-red-500">*</span>}
                </Label>
                <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between"
                    >
                      {selectedCustomer ? selectedCustomer.name : "Begin typing for results."}
                      <IconChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandInput
                        placeholder="Search customers..."
                        value={customerSearch}
                        onValueChange={setCustomerSearch}
                      />
                      <CommandList>
                        <CommandEmpty>No customers found.</CommandEmpty>
                        <CommandGroup>
                          {customers.map((customer) => (
                            <CommandItem
                              key={customer.id}
                              value={customer.id}
                              onSelect={() => {
                                setSelectedCustomer(customer)
                                setCustomerId(customer.id)
                                setCustomerOpen(false)
                              }}
                            >
                              <IconCheck
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  customerId === customer.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {customer.name} ({customer.sku})
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Date Fields */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Posting Date</Label>
                  <Input
                    type="date"
                    value={postingDate}
                    onChange={(e) => setPostingDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Posting Time</Label>
                  <Input
                    type="time"
                    value={postingTime}
                    onChange={(e) => setPostingTime(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm">
                  Edit Posting Date and Time
                </Button>
              </div>

              <div className="space-y-2">
                <Label>Payment Due Date</Label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>

              {/* Checkboxes */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="is-pos"
                    checked={isPos}
                    onCheckedChange={setIsPos}
                  />
                  <Label htmlFor="is-pos">Include Payment (POS)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="is-return"
                    checked={isReturn}
                    onCheckedChange={setIsReturn}
                  />
                  <Label htmlFor="is-return">Is Return (Credit Note)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="is-debit-note"
                    checked={isDebitNote}
                    onCheckedChange={setIsDebitNote}
                  />
                  <Label htmlFor="is-debit-note">
                    Is Rate Adjustment Entry (Debit Note)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="update-stock"
                    checked={updateStock}
                    onCheckedChange={setUpdateStock}
                  />
                  <Label htmlFor="update-stock">Update Stock</Label>
                </div>
              </div>

              {/* Items Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Items</h3>
                  <Popover open={itemOpen} onOpenChange={setItemOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm">
                        <IconPlus className="h-4 w-4 mr-2" />
                        Scan Barcode
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0" align="start">
                      <Command>
                        <CommandInput
                          placeholder={`Search ${isProduct ? 'products' : 'motorcycles'}...`}
                          value={itemSearch}
                          onValueChange={setItemSearch}
                        />
                        <CommandList>
                          <CommandEmpty>
                            No {isProduct ? 'products' : 'motorcycles'} found.
                          </CommandEmpty>
                          <CommandGroup>
                            {isProduct
                              ? products.map((product) => (
                                  <CommandItem
                                    key={product.id}
                                    value={product.id}
                                    onSelect={() => handleAddItem(product)}
                                  >
                                    {product.name} ({product.sku}) - {isWholesale ? product.jumlaPrice : product.mufradPrice} IQD
                                  </CommandItem>
                                ))
                              : motorcycles.map((motorcycle) => (
                                  <CommandItem
                                    key={motorcycle.id}
                                    value={motorcycle.id}
                                    onSelect={() => handleAddItem(motorcycle)}
                                  >
                                    {motorcycle.brand} {motorcycle.model} ({motorcycle.sku}) - {isWholesale ? motorcycle.usdWholesalePrice : motorcycle.usdRetailPrice} USD
                                  </CommandItem>
                                ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">No.</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead className="w-24">Quantity</TableHead>
                        <TableHead className="w-32">Rate (ع.د)</TableHead>
                        <TableHead className="w-32">Amount (ع.د)</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground">
                            No items added yet
                          </TableCell>
                        </TableRow>
                      ) : (
                        items.map((item, index) => (
                          <TableRow key={item.id}>
                            <TableCell>{index + 1}</TableCell>
                            <TableCell>{item.itemName}</TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) =>
                                  handleUpdateItem(item.id, 'quantity', parseInt(e.target.value) || 1)
                                }
                                className="w-20"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.rate}
                                onChange={(e) =>
                                  handleUpdateItem(item.id, 'rate', parseFloat(e.target.value) || 0)
                                }
                                className="w-28"
                              />
                            </TableCell>
                            <TableCell>{item.amount.toFixed(2)}</TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveItem(item.id)}
                              >
                                <IconX className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex justify-between text-sm">
                  <span>Total Quantity: {totalQty}</span>
                  <span>Total (ع.د): {total.toFixed(2)}</span>
                </div>
              </div>

              {/* Taxes and Charges */}
              <div className="space-y-4">
                <h3 className="font-semibold">Taxes and Charges</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tax Category</Label>
                    <Input
                      placeholder="Begin typing for results."
                      value={taxCategory}
                      onChange={(e) => setTaxCategory(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Sales Taxes and Charges Template</Label>
                    <Input
                      placeholder="Begin typing for results."
                      value={taxesAndCharges}
                      onChange={(e) => setTaxesAndCharges(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Shipping Rule</Label>
                    <Input
                      placeholder="Begin typing for results."
                      value={shippingRule}
                      onChange={(e) => setShippingRule(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Incoterm</Label>
                    <Input
                      placeholder="Begin typing for results."
                      value={incoterm}
                      onChange={(e) => setIncoterm(e.target.value)}
                    />
                  </div>
                </div>

                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>No.</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Account Head</TableHead>
                        <TableHead>Tax Rate</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          No Data
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                <div className="text-right">
                  <span className="text-sm">Total Taxes and Charges (ع.د): {totalTaxes.toFixed(2)}</span>
                </div>
              </div>

              {/* Totals */}
              <div className="space-y-2 border-t pt-4">
                <div className="flex justify-between">
                  <span className="font-semibold">Grand Total (ع.د)</span>
                  <span>{grandTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Rounding Adjustment (ع.د)</span>
                  <span>{roundingAdjustment.toFixed(2)}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch id="use-company-roundoff" />
                  <Label htmlFor="use-company-roundoff">
                    Use Company default Cost Center for Round off
                  </Label>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Rounded Total (ع.د)</span>
                  <span>{roundedTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Advance (ع.د)</span>
                  <span>{totalAdvance.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-semibold border-t pt-2">
                  <span>Outstanding Amount (ع.د)</span>
                  <span>{outstandingAmount.toFixed(2)}</span>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="payments" className="mt-0">
              <div className="space-y-4">
                <p className="text-muted-foreground">Payments section - To be implemented</p>
              </div>
            </TabsContent>

            <TabsContent value="address" className="mt-0">
              <div className="space-y-4">
                <p className="text-muted-foreground">Address & Contact section - To be implemented</p>
              </div>
            </TabsContent>

            <TabsContent value="terms" className="mt-0">
              <div className="space-y-4">
                <p className="text-muted-foreground">Terms section - To be implemented</p>
              </div>
            </TabsContent>

            <TabsContent value="more" className="mt-0">
              <div className="space-y-4">
                <p className="text-muted-foreground">More Info section - To be implemented</p>
              </div>
            </TabsContent>

            <TabsContent value="series" className="mt-0">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Naming Series</Label>
                  <Input
                    value={namingSeries}
                    onChange={(e) => setNamingSeries(e.target.value)}
                    placeholder="ACC-SINV-.YYYY.-"
                  />
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

