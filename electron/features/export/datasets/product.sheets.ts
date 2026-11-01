import { getDetails } from '../../items/items.service'
import { type SheetDef, col } from './sheet'
import { ITEM_COLUMNS, itemRow, MOVEMENT_COLUMNS, movementRows } from './item.rows'

export const productSheet: SheetDef = {
  key: 'product',
  layout: 'record',
  columns: [col('status', 'enum'), ...ITEM_COLUMNS],
  rows: ({ itemId }) => {
    if (!itemId) return []
    const { item } = getDetails({ id: itemId })
    return [{ status: item.deleted_at ? 'archived' : 'active', ...itemRow(item) }]
  }
}

export const productSummarySheet: SheetDef = {
  key: 'summary',
  layout: 'record',
  columns: [
    col('purchased_qty', 'number'), col('sold_qty', 'number'), col('sale_returns_qty', 'number'), col('purchase_returns_qty', 'number'),
    col('purchases_cost', 'money'), col('sales_total', 'money'), col('profit', 'money'), col('adjustment_new', 'number'), col('adjustment_damaged', 'number')
  ],
  rows: ({ itemId }) => {
    if (!itemId) return []
    const { totals, adjustments } = getDetails({ id: itemId })
    return [{ ...totals, adjustment_new: adjustments.new, adjustment_damaged: adjustments.damaged }]
  }
}

export const productMovementsSheet: SheetDef = {
  key: 'movements',
  columns: MOVEMENT_COLUMNS,
  rows: ({ itemId }) => (itemId ? movementRows(itemId) : [])
}
