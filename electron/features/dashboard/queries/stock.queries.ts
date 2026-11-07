/** الأرقام الحالية (مبتتأثرش بفلتر التاريخ): المخزن ورأس المال وعدد الأصناف ومستحقات العملاء */
import { queryOne } from '../../../database/connection'
import { saleRemaining } from '../../../lib/salePaid'
import { inWorkspace } from '../../../lib/workspace'

export const stock = () =>
  queryOne<{
    pieces: number
    new_pieces: number
    damaged_pieces: number
    cost_value: number
    new_cost_value: number
    damaged_cost_value: number
    selling_value: number
  }>(
    `SELECT COALESCE(SUM(s.quantity), 0) AS pieces,
            COALESCE(SUM(CASE WHEN s.condition = 'new' THEN s.quantity END), 0) AS new_pieces,
            COALESCE(SUM(CASE WHEN s.condition = 'damaged' THEN s.quantity END), 0) AS damaged_pieces,
            COALESCE(SUM(s.quantity * s.purchase_price), 0) AS cost_value,
            COALESCE(SUM(CASE WHEN s.condition = 'new' THEN s.quantity * s.purchase_price END), 0) AS new_cost_value,
            COALESCE(SUM(CASE WHEN s.condition = 'damaged' THEN s.quantity * s.purchase_price END), 0) AS damaged_cost_value,
            COALESCE(SUM(s.quantity * s.selling_price), 0) AS selling_value
     FROM item_stock s JOIN items i ON i.id = s.item_id WHERE i.deleted_at IS NULL AND ${inWorkspace('i.workspace_id')}`
  )!

export const counts = () =>
  queryOne<{ categories: number; items: number; customers: number }>(
    `SELECT (SELECT COUNT(*) FROM categories WHERE ${inWorkspace('workspace_id')}) AS categories,
            (SELECT COUNT(*) FROM items WHERE deleted_at IS NULL AND ${inWorkspace('workspace_id')}) AS items,
            (SELECT COUNT(*) FROM customers WHERE ${inWorkspace('workspace_id')}) AS customers`
  )!

/** إجمالي اللي لسه على العملاء (بعد الدفعات والمرتجعات) */
export const receivables = () =>
  queryOne<{ total: number }>(
    `SELECT COALESCE(SUM(${saleRemaining('s.id', 's.total')}), 0) AS total
     FROM sales s WHERE ${inWorkspace('s.workspace_id')}`
  )!.total

/** اللي اتحصّل من العملاء في الفترة (من أول دفعة وقت البيع) */
