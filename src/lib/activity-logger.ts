/**
 * Activity Logger
 * Helper functions to log activities for products and motorcycles
 */

import { prisma } from '@/lib/db'
import type { ActivityType, ActivityEntityType } from '@prisma/client'

interface ChangeDetail {
  [field: string]: {
    old: any
    new: any
  }
}

/**
 * Log an activity for a product or motorcycle
 */
export async function logActivity(
  entityType: ActivityEntityType,
  entityId: string,
  type: ActivityType,
  userId: string,
  description: string,
  changes?: ChangeDetail,
  invoiceId?: string | null
) {
  try {
    await prisma.activity.create({
      data: {
        entityType,
        entityId,
        type,
        description,
        changes: changes ? changes as any : null,
        invoiceId: invoiceId || null,
        createdById: userId,
      },
    })
  } catch (error) {
    console.error('Error logging activity:', error)
    // Don't throw - activity logging shouldn't break the main operation
  }
}

/**
 * Helper to create activity description from changes
 */
export function createActivityDescription(
  type: ActivityType,
  entityName: string,
  changes?: ChangeDetail
): string {
  const changeKeys = changes ? Object.keys(changes) : []
  
  switch (type) {
    case 'CREATED':
      return `${entityName} was created`
    
    case 'UPDATED':
      if (changeKeys.length === 0) {
        return `${entityName} was updated`
      }
      const changeLabels = changeKeys.map(key => {
        // Convert field names to readable labels
        const labelMap: { [key: string]: string } = {
          name: 'Name',
          sku: 'SKU',
          mufradPrice: 'Retail Price',
          jumlaPrice: 'Wholesale Price',
          usdRetailPrice: 'USD Retail Price',
          usdWholesalePrice: 'USD Wholesale Price',
          rmbPrice: 'RMB Price',
          stockQuantity: 'Stock Quantity',
          lowStockThreshold: 'Low Stock Threshold',
          categoryId: 'Category',
          brand: 'Brand',
          model: 'Model',
          notes: 'Notes',
        }
        return labelMap[key] || key
      })
      return `${entityName} was updated: ${changeLabels.join(', ')}`
    
    case 'STOCK_ADDED':
      return `Stock added to ${entityName}`
    
    case 'STOCK_REDUCED':
      return `Stock reduced for ${entityName}`
    
    case 'STOCK_ADJUSTED':
      return `Stock manually adjusted for ${entityName}`
    
    case 'PRICE_CHANGED':
      return `Price changed for ${entityName}`
    
    case 'IMAGE_CHANGED':
      return `Image updated for ${entityName}`
    
    case 'ATTACHMENT_ADDED':
      return `Attachment added to ${entityName}`
    
    case 'ATTACHMENT_REMOVED':
      return `Attachment removed from ${entityName}`
    
    case 'CATEGORY_CHANGED':
      return `Category changed for ${entityName}`
    
    case 'DELETED':
      return `${entityName} was deleted`
    
    case 'INVOICED':
      return `${entityName} was invoiced`
    
    default:
      return `${entityName} was modified`
  }
}

/**
 * Compare two objects and return changes
 */
export function getChanges<T extends Record<string, any>>(
  oldValue: T,
  newValue: T,
  fieldsToCompare?: (keyof T)[]
): ChangeDetail | undefined {
  const changes: ChangeDetail = {}
  const fields = fieldsToCompare || Object.keys(oldValue) as (keyof T)[]
  
  for (const field of fields) {
    const oldVal = oldValue[field]
    const newVal = newValue[field]
    
    // Deep comparison for objects/arrays
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes[field as string] = {
        old: oldVal,
        new: newVal,
      }
    }
  }
  
  return Object.keys(changes).length > 0 ? changes : undefined
}

