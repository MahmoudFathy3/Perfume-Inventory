import { queryAll } from '../../../database/connection'
import { dateClause } from '../../../lib/dateRange'
import { salePaid, saleRemaining } from '../../../lib/salePaid'
import { searchClause } from '../../../lib/search'
import { activeWorkspaceId, PERSONAL_WORKSPACE_ID, scoped } from '../../../lib/workspace'
import type { ExportColumn, ExportParams } from '@shared/types'
import { type Row, type SheetDef, col } from './sheet'

/** عمود الشريك اللي باع بيظهر بعد العميل في الشراكات بس */
const withPartner = (columns: ExportColumn[]) => () =>
  activeWorkspaceId() === PERSONAL_WORKSPACE_ID ? columns : columns.flatMap((c) => (c.key === 'customer' ? [c, col('partner', 'text', 18)] : [c]))

/** البحث + فلتر الشريك والفترة (لو متحددين) */
function salesWhere({ search, partnerId, ...range }: ExportParams) {
  const { where, params } = scoped('s.workspace_id', searchClause(['cu.name', 's.notes'], search))
  const dates = dateClause('s.sale_date', range)
  const byPartner = partnerId ? 'AND s.partner_id = @partnerId' : ''
  return { where: `${where} ${byPartner} ${dates.where}`, params: { ...params, ...dates.params, partnerId } }
}

// ربح الفاتورة = ربح الأصناف - شحن على المحل
const SALE_PROFIT = `(SELECT COALESCE(SUM(quantity * (selling_price - purchase_price)), 0) FROM sale_items WHERE sale_id = s.id)
                     - CASE WHEN s.shipping_payer = 'shop' THEN s.shipping_cost ELSE 0 END`

export const salesSheet: SheetDef = {
  key: 'sales',
  columns: withPartner([
    col('id', 'number', 10), col('date', 'date'), col('customer', 'text', 24), col('price_type', 'enum', 12), col('lines_count', 'number', 12), col('total_quantity', 'number', 12),
    col('subtotal', 'money'), col('shipping_cost', 'money'), col('shipping_payer', 'enum', 12), col('total', 'money'),
    col('paid', 'money'), col('remaining', 'money'),
    col('cost_total', 'money'), col('profit', 'money'), col('returns_total', 'money'), col('notes', 'text', 30)
  ]),
  rows: (p) => {
    const { where, params } = salesWhere(p)
    return queryAll<Row>(
      `SELECT s.id, s.sale_date AS date, cu.name AS customer, wp.name AS partner, s.price_type,
              (SELECT COUNT(*) FROM sale_items WHERE sale_id = s.id) AS lines_count,
              (SELECT COALESCE(SUM(quantity), 0) FROM sale_items WHERE sale_id = s.id) AS total_quantity,
              s.total - CASE WHEN s.shipping_payer = 'customer' THEN s.shipping_cost ELSE 0 END AS subtotal,
              s.shipping_cost, s.shipping_payer, s.total,
              ROUND(${salePaid('s.id')}, 2) AS paid,
              ${saleRemaining('s.id', 's.total')} AS remaining,
              (SELECT COALESCE(SUM(quantity * purchase_price), 0) FROM sale_items WHERE sale_id = s.id) AS cost_total,
              ${SALE_PROFIT} AS profit,
              (SELECT COALESCE(SUM(total), 0) FROM returns WHERE sale_id = s.id) AS returns_total, s.notes
       FROM sales s LEFT JOIN customers cu ON cu.id = s.customer_id LEFT JOIN workspace_partners wp ON wp.id = s.partner_id
       ${where} ORDER BY s.sale_date DESC, s.id DESC`,
      params
    )
  }
}

export const saleItemsSheet: SheetDef = {
  key: 'sale_items',
  columns: withPartner([
    col('invoice', 'number', 10), col('date', 'date'), col('customer', 'text', 22), col('name_ar', 'text', 24), col('name_en', 'text', 24),
    col('category', 'text', 18), col('condition', 'enum', 12), col('quantity', 'number', 10), col('cost', 'money'),
    col('selling_price', 'money'), col('line_total', 'money'), col('profit', 'money'), col('invoice_notes', 'text', 28)
  ]),
  rows: (p) => {
    const { where, params } = salesWhere(p)
    return queryAll<Row>(
      `SELECT s.id AS invoice, s.sale_date AS date, cu.name AS customer, wp.name AS partner, i.name_ar, i.name_en, c.name AS category,
              si.condition, si.quantity, si.purchase_price AS cost, si.selling_price,
              si.quantity * si.selling_price AS line_total,
              si.quantity * (si.selling_price - si.purchase_price) AS profit, s.notes AS invoice_notes
       FROM sale_items si JOIN sales s ON s.id = si.sale_id LEFT JOIN customers cu ON cu.id = s.customer_id LEFT JOIN workspace_partners wp ON wp.id = s.partner_id
       JOIN items i ON i.id = si.item_id JOIN categories c ON c.id = si.category_id
       ${where} ORDER BY s.sale_date DESC, s.id DESC, si.id`,
      params
    )
  }
}
