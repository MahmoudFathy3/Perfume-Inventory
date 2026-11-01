import { queryAll } from '../../../database/connection'
import { searchClause } from '../../../lib/search'
import { scoped } from '../../../lib/workspace'
import { type Row, type SheetDef, col } from './sheet'

export const purchasesSheet: SheetDef = {
  key: 'purchases',
  columns: [
    col('id', 'number', 10), col('date', 'date'), col('supplier', 'text', 24), col('lines_count', 'number', 12), col('total_quantity', 'number', 12),
    col('subtotal', 'money'), col('shipping_cost', 'money'), col('total', 'money'), col('returns_total', 'money'), col('notes', 'text', 30)
  ],
  rows: ({ search }) => {
    const { where, params } = scoped('p.workspace_id', searchClause(['p.supplier_name', 'p.notes'], search))
    return queryAll<Row>(
      `SELECT p.id, p.purchase_date AS date, p.supplier_name AS supplier,
              (SELECT COUNT(*) FROM purchase_items WHERE purchase_id = p.id) AS lines_count,
              (SELECT COALESCE(SUM(quantity), 0) FROM purchase_items WHERE purchase_id = p.id) AS total_quantity,
              p.total - p.shipping_cost AS subtotal, p.shipping_cost, p.total,
              (SELECT COALESCE(SUM(total), 0) FROM returns WHERE purchase_id = p.id) AS returns_total, p.notes
       FROM purchases p ${where} ORDER BY p.purchase_date DESC, p.id DESC`,
      params
    )
  }
}

export const purchaseItemsSheet: SheetDef = {
  key: 'purchase_items',
  columns: [
    col('invoice', 'number', 10), col('date', 'date'), col('supplier', 'text', 22), col('name_ar', 'text', 24), col('name_en', 'text', 24),
    col('category', 'text', 18), col('condition', 'enum', 12), col('quantity', 'number', 10), col('purchase_price', 'money'),
    col('shipping_share', 'money'), col('landed_cost', 'money'), col('selling_price', 'money'), col('wholesale_price', 'money'),
    col('line_total', 'money'), col('invoice_notes', 'text', 28)
  ],
  rows: ({ search }) => {
    const { where, params } = scoped('p.workspace_id', searchClause(['p.supplier_name', 'p.notes'], search))
    return queryAll<Row>(
      `SELECT p.id AS invoice, p.purchase_date AS date, p.supplier_name AS supplier, i.name_ar, i.name_en, c.name AS category,
              pi.condition, pi.quantity, pi.purchase_price, (pi.landed_cost - pi.purchase_price) * pi.quantity AS shipping_share,
              pi.landed_cost, pi.selling_price, pi.wholesale_price, pi.quantity * pi.purchase_price AS line_total, p.notes AS invoice_notes
       FROM purchase_items pi JOIN purchases p ON p.id = pi.purchase_id
       JOIN items i ON i.id = pi.item_id JOIN categories c ON c.id = pi.category_id
       ${where} ORDER BY p.purchase_date DESC, p.id DESC, pi.id`,
      params
    )
  }
}
