import { queryAll } from '../../../database/connection'
import { searchClause } from '../../../lib/search'
import { scoped } from '../../../lib/workspace'
import { type Row, type SheetDef, col } from './sheet'

// ربح الفاتورة = ربح الأصناف - شحن على المحل
const SALE_PROFIT = `(SELECT COALESCE(SUM(quantity * (selling_price - purchase_price)), 0) FROM sale_items WHERE sale_id = s.id)
                     - CASE WHEN s.shipping_payer = 'shop' THEN s.shipping_cost ELSE 0 END`

export const salesSheet: SheetDef = {
  key: 'sales',
  columns: [
    col('id', 'number', 10), col('date', 'date'), col('customer', 'text', 24), col('price_type', 'enum', 12), col('lines_count', 'number', 12), col('total_quantity', 'number', 12),
    col('subtotal', 'money'), col('shipping_cost', 'money'), col('shipping_payer', 'enum', 12), col('total', 'money'),
    col('paid', 'money'), col('remaining', 'money'),
    col('cost_total', 'money'), col('profit', 'money'), col('returns_total', 'money'), col('notes', 'text', 30)
  ],
  rows: ({ search }) => {
    const { where, params } = scoped('s.workspace_id', searchClause(['cu.name', 's.notes'], search))
    return queryAll<Row>(
      `SELECT s.id, s.sale_date AS date, cu.name AS customer, s.price_type,
              (SELECT COUNT(*) FROM sale_items WHERE sale_id = s.id) AS lines_count,
              (SELECT COALESCE(SUM(quantity), 0) FROM sale_items WHERE sale_id = s.id) AS total_quantity,
              s.total - CASE WHEN s.shipping_payer = 'customer' THEN s.shipping_cost ELSE 0 END AS subtotal,
              s.shipping_cost, s.shipping_payer, s.total,
              ROUND(COALESCE((SELECT SUM(amount) FROM sale_payments WHERE sale_id = s.id), 0), 2) AS paid,
              MAX(0, ROUND(s.total - COALESCE((SELECT SUM(total) FROM returns WHERE sale_id = s.id), 0)
                                   - COALESCE((SELECT SUM(amount) FROM sale_payments WHERE sale_id = s.id), 0), 2)) AS remaining,
              (SELECT COALESCE(SUM(quantity * purchase_price), 0) FROM sale_items WHERE sale_id = s.id) AS cost_total,
              ${SALE_PROFIT} AS profit,
              (SELECT COALESCE(SUM(total), 0) FROM returns WHERE sale_id = s.id) AS returns_total, s.notes
       FROM sales s LEFT JOIN customers cu ON cu.id = s.customer_id
       ${where} ORDER BY s.sale_date DESC, s.id DESC`,
      params
    )
  }
}

export const saleItemsSheet: SheetDef = {
  key: 'sale_items',
  columns: [
    col('invoice', 'number', 10), col('date', 'date'), col('customer', 'text', 22), col('name_ar', 'text', 24), col('name_en', 'text', 24),
    col('category', 'text', 18), col('condition', 'enum', 12), col('quantity', 'number', 10), col('cost', 'money'),
    col('selling_price', 'money'), col('line_total', 'money'), col('profit', 'money'), col('invoice_notes', 'text', 28)
  ],
  rows: ({ search }) => {
    const { where, params } = scoped('s.workspace_id', searchClause(['cu.name', 's.notes'], search))
    return queryAll<Row>(
      `SELECT s.id AS invoice, s.sale_date AS date, cu.name AS customer, i.name_ar, i.name_en, c.name AS category,
              si.condition, si.quantity, si.purchase_price AS cost, si.selling_price,
              si.quantity * si.selling_price AS line_total,
              si.quantity * (si.selling_price - si.purchase_price) AS profit, s.notes AS invoice_notes
       FROM sale_items si JOIN sales s ON s.id = si.sale_id LEFT JOIN customers cu ON cu.id = s.customer_id
       JOIN items i ON i.id = si.item_id JOIN categories c ON c.id = si.category_id
       ${where} ORDER BY s.sale_date DESC, s.id DESC, si.id`,
      params
    )
  }
}
