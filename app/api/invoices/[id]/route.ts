import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = await params

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            sku: true,
            email: true,
            phone: true,
            debtIqd: true,
            debtUsd: true,
            currentBalance: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        sale: {
          include: {
            items: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    sku: true,
                    stockQuantity: true,
                  },
                },
              },
            },
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                stockQuantity: true,
              },
            },
          },
          orderBy: {
            order: 'asc',
          },
        },
      },
    })

    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      )
    }

    // Determine currency based on items (motorcycle = USD, product = IQD)
    const isMotorcycle = invoice.items?.some((item) => {
      const productName = item.product?.name?.toLowerCase() || ''
      const notes = item.notes?.toLowerCase() || ''
      return productName.includes('motorcycle') || notes.startsWith('motorcycle:')
    }) || false
    const getCurrency = isMotorcycle ? 'USD' : 'IQD' // Currency for GET response

    // Convert Decimal to number
    const invoiceWithNumbers = {
      ...invoice,
      currency: getCurrency,
      subtotal: Number(invoice.subtotal),
      taxAmount: Number(invoice.taxAmount),
      discount: Number(invoice.discount),
      total: Number(invoice.total),
      amountPaid: Number(invoice.amountPaid),
      amountDue: Number(invoice.amountDue),
      invoiceDate: invoice.invoiceDate.toISOString(),
      dueDate: invoice.dueDate?.toISOString() || null,
      paidAt: invoice.paidAt?.toISOString() || null,
      createdAt: invoice.createdAt.toISOString(),
      updatedAt: invoice.updatedAt.toISOString(),
      items: invoice.items && invoice.items.length > 0 
        ? invoice.items.map((item) => ({
            id: item.id,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
            discount: Number(item.discount),
            taxRate: Number(item.taxRate),
            lineTotal: Number(item.lineTotal),
            notes: item.notes,
            order: item.order,
            product: item.product ? {
              id: item.product.id,
              name: item.product.name,
              sku: item.product.sku,
              stockQuantity: item.product.stockQuantity,
            } : null,
          }))
        : [],
      sale: invoice.sale ? {
        id: invoice.sale.id,
        type: invoice.sale.type,
        status: invoice.sale.status,
        paymentMethod: invoice.sale.paymentMethod,
        items: invoice.sale.items ? invoice.sale.items.map((item) => ({
          id: item.id,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          discount: Number(item.discount),
          taxRate: Number(item.taxRate),
          lineTotal: Number(item.lineTotal),
          notes: item.notes,
          product: item.product ? {
            id: item.product.id,
            name: item.product.name,
            sku: item.product.sku,
            stockQuantity: item.product.stockQuantity,
          } : null,
        })) : [],
      } : null,
      customer: invoice.customer ? {
        ...invoice.customer,
        debtIqd: invoice.customer.debtIqd ? Number(invoice.customer.debtIqd) : 0,
        debtUsd: invoice.customer.debtUsd ? Number(invoice.customer.debtUsd) : 0,
        currentBalance: invoice.customer.currentBalance ? Number(invoice.customer.currentBalance) : 0,
      } : null,
    }

    return NextResponse.json({ invoice: invoiceWithNumbers })
  } catch (error) {
    console.error('Error fetching invoice:', error)
    return NextResponse.json(
      { error: 'Failed to fetch invoice' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = await params
    const body = await request.json()

    // Get current user ID
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Determine currency from items (motorcycle = USD, product = IQD)
    const hasMotorcycle = body.items?.some((item: any) => 
      item.notes?.startsWith('MOTORCYCLE:') || item.productName?.toLowerCase().includes('motorcycle')
    ) || false
    const invoiceCurrency = hasMotorcycle ? 'USD' : 'IQD' // Renamed to avoid conflict with response currency

    // Update invoice with reversal of original impact and application of new impact
    const updatedInvoice = await prisma.$transaction(async (tx) => {
      // First, fetch the original invoice with all data
      const originalInvoice = await tx.invoice.findUnique({
        where: { id },
        include: {
          customer: true,
          items: {
            include: {
              product: true,
            },
          },
          sale: {
            include: {
              items: true,
            },
          },
        },
      })

      if (!originalInvoice) {
        throw new Error('Invoice not found')
      }

      // REVERSE ORIGINAL IMPACT:
      // 1. Delete old stock movements related to this invoice
      await tx.stockMovement.deleteMany({
        where: {
          invoiceId: id,
        },
      })

      // 2. Restore stock quantities for original items
      // Aggregate quantities by product/motorcycle ID to handle duplicates correctly
      const stockRestore: Map<string, { type: 'product' | 'motorcycle', quantity: number }> = new Map()
      
      for (const item of originalInvoice.items) {
        const isMotorcycle = item.notes?.startsWith('MOTORCYCLE:')
        
        if (isMotorcycle && item.notes) {
          const motorcycleId = item.notes.replace('MOTORCYCLE:', '')
          const key = `motorcycle:${motorcycleId}`
          const existing = stockRestore.get(key)
          stockRestore.set(key, {
            type: 'motorcycle',
            quantity: (existing?.quantity || 0) + item.quantity,
          })
        } else if (item.productId) {
          const key = `product:${item.productId}`
          const existing = stockRestore.get(key)
          stockRestore.set(key, {
            type: 'product',
            quantity: (existing?.quantity || 0) + item.quantity,
          })
        }
      }

      // Now restore stock for each unique product/motorcycle
      for (const [key, data] of stockRestore.entries()) {
        if (data.type === 'motorcycle') {
          const motorcycleId = key.replace('motorcycle:', '')
          const motorcycle = await tx.motorcycle.findUnique({
            where: { id: motorcycleId },
            select: { stockQuantity: true },
          })
          if (motorcycle) {
            // Restore stock: add back the total quantity that was sold for this motorcycle
            await tx.motorcycle.update({
              where: { id: motorcycleId },
              data: {
                stockQuantity: motorcycle.stockQuantity + data.quantity,
              },
            })
          }
        } else {
          const productId = key.replace('product:', '')
          const product = await tx.product.findUnique({
            where: { id: productId },
            select: { stockQuantity: true },
          })
          if (product) {
            // Restore stock: add back the total quantity that was sold for this product
            await tx.product.update({
              where: { id: productId },
              data: {
                stockQuantity: product.stockQuantity + data.quantity,
              },
            })
          }
        }
      }

      // 3. Reverse customer debt update (if invoice was finalized)
      // Always reverse from the original customer, even if customer is changing
      // Check if invoice was finalized (not DRAFT, not CANCELLED)
      const wasFinalized = originalInvoice.status && 
                          originalInvoice.status !== 'DRAFT' && 
                          originalInvoice.status !== 'CANCELLED'
      
      if (wasFinalized && originalInvoice.customerId) {
        const originalCustomer = await tx.customer.findUnique({
          where: { id: originalInvoice.customerId },
        })
        
        if (originalCustomer) {
          const originalAmountDue = Number(originalInvoice.amountDue || 0)
          
          // Reverse: subtract the original amountDue from debt
          // This ensures that when we add the new debt later, the net change is correct
          if (originalAmountDue > 0) {
            const updateData: any = {}
            
            // Determine original currency (check original items)
            const originalIsMotorcycle = originalInvoice.items.some((item) => 
              item.notes?.startsWith('MOTORCYCLE:')
            )
            const originalCurrency = originalIsMotorcycle ? 'USD' : 'IQD'
            
            if (originalCurrency === 'IQD') {
              // Reverse IQD debt and balance
              const currentDebtIqd = Number(originalCustomer.debtIqd || 0)
              const currentBalance = Number(originalCustomer.currentBalance || 0)
              // Ensure we don't go below 0
              updateData.debtIqd = Math.max(0, currentDebtIqd - originalAmountDue)
              updateData.currentBalance = Math.max(0, currentBalance - originalAmountDue)
            } else {
              // Reverse USD debt only (currentBalance is for IQD, not USD)
              const currentDebtUsd = Number(originalCustomer.debtUsd || 0)
              // Ensure we don't go below 0
              updateData.debtUsd = Math.max(0, currentDebtUsd - originalAmountDue)
              // Do NOT update currentBalance for USD transactions
            }
            
            // Only update if there's actually a change to make
            if (Object.keys(updateData).length > 0) {
              await tx.customer.update({
                where: { id: originalInvoice.customerId },
                data: updateData,
              })
            }
          }
        }
      }

      // UPDATE INVOICE WITH NEW DATA:
      // Update invoice record (including status if provided)
      const invoiceUpdateData: any = {
        customerId: body.customerId || null,
        invoiceDate: body.invoiceDate ? new Date(body.invoiceDate) : undefined,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        subtotal: body.subtotal,
        taxAmount: body.taxAmount,
        discount: body.discount,
        total: body.total,
        amountPaid: body.amountPaid,
        amountDue: body.amountDue,
        updatedAt: new Date(),
      }

      // Update status if provided (only allow PAID or PARTIALLY_PAID)
      if (body.status) {
        // Validate status - only allow PAID or PARTIALLY_PAID
        if (body.status !== 'PAID' && body.status !== 'PARTIALLY_PAID') {
          throw new Error('Invoice status must be either PAID or PARTIALLY_PAID')
        }
        invoiceUpdateData.status = body.status
        if (body.status === 'PAID') {
          invoiceUpdateData.paidAt = new Date()
        } else if (originalInvoice.status === 'PAID' && body.status !== 'PAID') {
          invoiceUpdateData.paidAt = null
        }
      }

      const invoice = await tx.invoice.update({
        where: { id },
        data: invoiceUpdateData,
        include: {
          sale: true,
        },
      })

      // Delete existing invoice items
      await tx.invoiceItem.deleteMany({
        where: { invoiceId: id },
      })

      // Delete existing sale items
      if (invoice.sale) {
        await tx.saleItem.deleteMany({
          where: { saleId: invoice.sale.id },
        })
      }

      // Create new invoice items
      if (body.items && body.items.length > 0) {
        await tx.invoiceItem.createMany({
          data: body.items.map((item: any, index: number) => ({
            invoiceId: id,
            productId: item.productId || null,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount || 0,
            taxRate: item.taxRate || 0,
            lineTotal: item.lineTotal || item.unitPrice * item.quantity,
            notes: item.notes || null,
            order: item.order ?? index,
          })),
        })

        // Create new sale items
        if (invoice.sale) {
          await tx.saleItem.createMany({
            data: body.items.map((item: any, index: number) => ({
              saleId: invoice.sale!.id,
              productId: item.productId || null,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: item.discount || 0,
              taxRate: item.taxRate || 0,
              lineTotal: item.lineTotal || item.unitPrice * item.quantity,
              notes: item.notes || null,
              order: item.order ?? index,
            })),
          })
        }

        // APPLY NEW IMPACT:
        // 4. Update stock quantities for new items
        // Aggregate quantities by product/motorcycle ID to handle duplicates correctly
        const stockReduce: Map<string, { type: 'product' | 'motorcycle', quantity: number, item: any }> = new Map()
        
        for (const item of body.items) {
          const isMotorcycle = item.notes?.startsWith('MOTORCYCLE:')
          
          if (isMotorcycle) {
            const motorcycleId = item.notes.replace('MOTORCYCLE:', '')
            const key = `motorcycle:${motorcycleId}`
            const existing = stockReduce.get(key)
            stockReduce.set(key, {
              type: 'motorcycle',
              quantity: (existing?.quantity || 0) + item.quantity,
              item: item, // Keep first item for reference
            })
          } else if (item.productId) {
            const key = `product:${item.productId}`
            const existing = stockReduce.get(key)
            stockReduce.set(key, {
              type: 'product',
              quantity: (existing?.quantity || 0) + item.quantity,
              item: item, // Keep first item for reference
            })
          }
        }

        // Now reduce stock for each unique product/motorcycle
        for (const [key, data] of stockReduce.entries()) {
          if (data.type === 'motorcycle') {
            const motorcycleId = key.replace('motorcycle:', '')
            const motorcycle = await tx.motorcycle.findUnique({
              where: { id: motorcycleId },
              select: { stockQuantity: true },
            })
            
            if (motorcycle) {
              // Validate stock (already restored, so current stock should include original sold quantity)
              if (data.quantity > motorcycle.stockQuantity) {
                throw new Error(`Insufficient stock for motorcycle. Available: ${motorcycle.stockQuantity}, Requested: ${data.quantity}`)
              }
              
              // Reduce stock
              await tx.motorcycle.update({
                where: { id: motorcycleId },
                data: {
                  stockQuantity: Math.max(0, motorcycle.stockQuantity - data.quantity),
                },
              })
            }
          } else {
            const productId = key.replace('product:', '')
            const product = await tx.product.findUnique({
              where: { id: productId },
              select: { stockQuantity: true },
            })
            
            if (product) {
              // Validate stock (already restored, so current stock should include original sold quantity)
              if (data.quantity > product.stockQuantity) {
                throw new Error(`Insufficient stock for product. Available: ${product.stockQuantity}, Requested: ${data.quantity}`)
              }
              
              // Reduce stock
              const newStock = Math.max(0, product.stockQuantity - data.quantity)
              await tx.product.update({
                where: { id: productId },
                data: {
                  stockQuantity: newStock,
                },
              })
              
              // Create stock movement record (audit trail) - one per product with total quantity
              await tx.stockMovement.create({
                data: {
                  productId: productId,
                  type: 'SALE',
                  quantity: -data.quantity, // Negative = decrease, total quantity for this product
                  balanceAfter: newStock,
                  invoiceId: id,
                  saleId: invoice.sale?.id || null,
                  createdById: user.id,
                },
              })
            }
          }
        }
      }

      // 5. Update customer debt with new amount (only if invoice was finalized)
      // Apply to the new customer (which might be the same or different from original)
      // CRITICAL: We already reversed the original debt above, so now we just add the new debt
      // Only add new debt if the invoice is being finalized (status is not DRAFT)
      const willBeFinalized = (body.status && body.status !== 'DRAFT') || 
                              (!body.status && originalInvoice.status !== 'DRAFT')
      
      if (willBeFinalized && body.customerId) {
        // Determine new currency based on new items (must match reversal currency logic)
        const newHasMotorcycle = body.items?.some((item: any) => 
          item.notes?.startsWith('MOTORCYCLE:')
        ) || false
        const newInvoiceCurrency = newHasMotorcycle ? 'USD' : 'IQD'
        
        // Fetch the customer again to get the current state after reversal
        // If customer is the same, this will have the reversed debt already applied
        // If customer is different, this will be a fresh customer record
        const newCustomer = await tx.customer.findUnique({
          where: { id: body.customerId },
        })

        if (newCustomer) {
          const newAmountDue = Number(body.amountDue || 0)
          const updateData: any = {}

          // Calculate payment status
          const amountPaid = Number(body.amountPaid || 0)
          const total = Number(body.total || 0)
          const isPaid = Math.abs(amountPaid - total) < 0.01 || amountPaid >= total

          // CRITICAL: Always update debt based on amountDue (can be positive or negative)
          // We already reversed the original debt above, so now we add the new debt
          // This handles all payment scenarios correctly:
          // - If amountDue > 0: Customer still owes money, add to debt
          // - If amountDue < 0: Customer overpaid (credit), reduce debt
          // - If amountDue = 0 (fully paid): No change to debt
          // Products (IQD): Update debtIqd AND currentBalance
          // Motorcycles (USD): Update debtUsd (debtUsd serves as USD balance/debt)
          // Always update debt with amountDue (positive adds debt, negative reduces it)
          if (newInvoiceCurrency === 'IQD') {
            // Product invoice - update IQD debt and balance
            const currentDebtIqd = Number(newCustomer.debtIqd || 0)
            const currentBalance = Number(newCustomer.currentBalance || 0)
            updateData.debtIqd = currentDebtIqd + newAmountDue
            updateData.currentBalance = currentBalance + newAmountDue // Positive = owes, Negative = credit
          } else {
            // USD currency (Motorcycle invoice) - update USD debt
            // debtUsd serves as both debt and balance for USD transactions
            const currentDebtUsd = Number(newCustomer.debtUsd || 0)
            updateData.debtUsd = currentDebtUsd + newAmountDue
            // Do NOT update currentBalance for USD transactions (it's IQD-specific)
          }
          
          // Update payment date if fully paid or overpaid
          if (isPaid || newAmountDue <= 0) {
            updateData.lastPaymentDate = new Date()
          }

          // Always update if we have data (even if just payment date)
          if (Object.keys(updateData).length > 0) {
            await tx.customer.update({
              where: { id: body.customerId },
              data: updateData,
            })
          }
        }
      }

      // Update sale totals if sale exists
      if (invoice.sale) {
        await tx.sale.update({
          where: { id: invoice.sale.id },
          data: {
            total: body.total,
            updatedAt: new Date(),
          },
        })
      }

      return invoice
    })

    // Fetch updated invoice with all relations
    const updatedInvoiceWithRelations = await prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            sku: true,
            email: true,
            phone: true,
            debtIqd: true,
            debtUsd: true,
            currentBalance: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        sale: {
          include: {
            items: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    sku: true,
                    stockQuantity: true,
                  },
                },
              },
            },
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                stockQuantity: true,
              },
            },
          },
          orderBy: {
            order: 'asc',
          },
        },
      },
    })

    if (!updatedInvoiceWithRelations) {
      return NextResponse.json(
        { error: 'Invoice not found after update' },
        { status: 404 }
      )
    }

    // Determine currency for response (motorcycle = USD, product = IQD)
    const isMotorcycleResponse = updatedInvoiceWithRelations.items?.some((item) => {
      // Check if item is a motorcycle (productId is null and notes start with MOTORCYCLE:)
      if (!item.productId && item.notes) {
        const notes = item.notes.toUpperCase().trim()
        if (notes.startsWith('MOTORCYCLE:')) {
          return true
        }
      }
      // Fallback: check product name
      const productName = item.product?.name?.toLowerCase() || ''
      const notes = item.notes?.toLowerCase() || ''
      return productName.includes('motorcycle') || notes.startsWith('motorcycle:')
    }) || false
    const responseCurrency = isMotorcycleResponse ? 'USD' : 'IQD' // Response currency (not invoiceCurrency)

    // Convert to response format
    const invoiceWithNumbers = {
      ...updatedInvoiceWithRelations,
      currency: responseCurrency,
      subtotal: Number(updatedInvoiceWithRelations.subtotal),
      taxAmount: Number(updatedInvoiceWithRelations.taxAmount),
      discount: Number(updatedInvoiceWithRelations.discount),
      total: Number(updatedInvoiceWithRelations.total),
      amountPaid: Number(updatedInvoiceWithRelations.amountPaid),
      amountDue: Number(updatedInvoiceWithRelations.amountDue),
      invoiceDate: updatedInvoiceWithRelations.invoiceDate.toISOString(),
      dueDate: updatedInvoiceWithRelations.dueDate?.toISOString() || null,
      paidAt: updatedInvoiceWithRelations.paidAt?.toISOString() || null,
      createdAt: updatedInvoiceWithRelations.createdAt.toISOString(),
      updatedAt: updatedInvoiceWithRelations.updatedAt.toISOString(),
      items: updatedInvoiceWithRelations.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        discount: Number(item.discount),
        taxRate: Number(item.taxRate),
        lineTotal: Number(item.lineTotal),
        notes: item.notes,
        order: item.order,
        product: item.product ? {
          id: item.product.id,
          name: item.product.name,
          sku: item.product.sku,
          stockQuantity: item.product.stockQuantity,
        } : null,
      })),
      sale: updatedInvoiceWithRelations.sale ? {
        id: updatedInvoiceWithRelations.sale.id,
        type: updatedInvoiceWithRelations.sale.type,
        status: updatedInvoiceWithRelations.sale.status,
        paymentMethod: updatedInvoiceWithRelations.sale.paymentMethod,
        items: updatedInvoiceWithRelations.sale.items ? updatedInvoiceWithRelations.sale.items.map((item) => ({
          id: item.id,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          discount: Number(item.discount),
          taxRate: Number(item.taxRate),
          lineTotal: Number(item.lineTotal),
          notes: item.notes,
          product: item.product ? {
            id: item.product.id,
            name: item.product.name,
            sku: item.product.sku,
            stockQuantity: item.product.stockQuantity,
          } : null,
        })) : [],
      } : null,
      customer: updatedInvoiceWithRelations.customer ? {
        ...updatedInvoiceWithRelations.customer,
        debtIqd: updatedInvoiceWithRelations.customer.debtIqd ? Number(updatedInvoiceWithRelations.customer.debtIqd) : 0,
        debtUsd: updatedInvoiceWithRelations.customer.debtUsd ? Number(updatedInvoiceWithRelations.customer.debtUsd) : 0,
        currentBalance: updatedInvoiceWithRelations.customer.currentBalance ? Number(updatedInvoiceWithRelations.customer.currentBalance) : 0,
      } : null,
    }

    return NextResponse.json({ invoice: invoiceWithNumbers })
  } catch (error) {
    console.error('Error updating invoice:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update invoice' },
      { status: 500 }
    )
  }
}
