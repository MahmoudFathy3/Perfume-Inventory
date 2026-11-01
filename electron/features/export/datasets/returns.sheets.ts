import { queryAll } from '../../../database/connection'
import { searchClause } from '../../../lib/search'
import { scoped } from '../../../lib/workspace'
import { type Row, type SheetDef, col } from './sheet'

export const returnsSheet: SheetDef = {
  key: 'returns',
  columns: [
    col('id', 'number', 10), col('date', 'date'), col('type', 'enum', 16), col('source_invoice', 'number', 14), col('party', 'text', 24),
    col('reason', 'text', 28), col('lines_count', 'number', 12), col('total_quantity', 'number', 12), col('total', 'money')
  ],
  rows: ({ search }) => {
    const { where, params } = scoped('r.workspace_id', searchClause(['r.reason', 'cu.name', 'p.supplier_name'], search))
    return queryAll<Row>(
      `SELECT r.id, r.return_date AS date, r.type, COALESCE(r.sale_id, r.purchase_id) AS source_invoice,
              COALESCE(cu.name, p.supplier_name) AS party, r.reason,
              (SELECT COUNT(*) FROM return_items WHERE return_id = r.id) AS lines_count,
              (SELECT COALESCE(SUM(quantity), 0) FROM return_items WHERE return_id = r.id) AS total_quantity, r.total
       FROM returns r LEFT JOIN sales s ON s.id = r.sale_id LEFT JOIN customers cu ON cu.id = s.customer_id
       LEFT JOIN purchases p ON p.id = r.purchase_id
       ${where} ORDER BY r.return_date DESC, r.id DESC`,
      params
    )
  }
}

export const returnItemsSheet: SheetDef = {
  key: 'return_items',
  columns: [
    col('invoice', 'number', 10), col('date', 'date'), col('type', 'enum', 16), col('source_invoice', 'number', 14), col('party', 'text', 22),
    col('name_ar', 'text', 24), col('name_en', 'text', 24), col('condition', 'enum', 12), col('quantity', 'number', 10),
    col('unit_price', 'money'), col('line_total', 'money'), col('reason', 'text', 26)
  ],
  rows: ({ search }) => {
    const { where, params } = scoped('r.workspace_id', searchClause(['r.reason', 'cu.name', 'p.supplier_name'], search))
    return queryAll<Row>(
      `SELECT r.id AS invoice, r.return_date AS date, r.type, COALESCE(r.sale_id, r.purchase_id) AS source_invoice,
              COALESCE(cu.name, p.supplier_name) AS party, i.name_ar, i.name_en, ri.condition, ri.quantity,
              ri.unit_price, ri.quantity * ri.unit_price AS line_total, r.reason
       FROM return_items ri JOIN returns r ON r.id = ri.return_id
       LEFT JOIN sales s ON s.id = r.sale_id LEFT JOIN customers cu ON cu.id = s.customer_id
       LEFT JOIN purchases p ON p.id = r.purchase_id
       JOIN items i ON i.id = ri.item_id
       ${where} ORDER BY r.return_date DESC, r.id DESC, ri.id`,
      params
    )
  }
}
