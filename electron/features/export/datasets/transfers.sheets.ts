import type { ExportParams, TransfersFilter } from '@shared/types'
import { queryAll } from '../../../database/connection'
import { filtered } from '../../transfers/transfers.repository'
import { storeName } from './stores'
import { type Row, type SheetDef, col } from './sheet'

/** نفس فلتر صفحة التحويلات */
const filterOf = ({ search, kind, direction, payment, from, to }: ExportParams): TransfersFilter => ({ search, kind, direction, payment, from, to })

// قيم بتتترجم من قيم التصدير (transfer_* علشان "بيع بسعر" في التحويل غير "بيع" في الفواتير)
const DIRECTION = `CASE WHEN f.from_workspace_id = @ws THEN 'transfer_out' ELSE 'transfer_in' END`
const KIND = `'transfer_' || f.kind`
const STORES = `${storeName('f.from_workspace_id')} AS from_store, ${storeName('f.to_workspace_id')} AS to_store`

export const transfersSheet: SheetDef = {
  key: 'transfers',
  columns: [
    col('id', 'number', 10), col('date', 'date'), col('direction', 'enum', 12), col('transfer_kind', 'enum', 14),
    col('from_store', 'enum', 24), col('to_store', 'enum', 24), col('partner', 'text', 18), col('pieces', 'number', 10),
    col('cost_total', 'money'), col('transfer_price', 'money'), col('paid', 'money'), col('remaining', 'money'),
    col('source_invoice', 'number', 12), col('notes', 'text', 30)
  ],
  rows: (p) => {
    const { sql, params } = filtered(filterOf(p))
    return queryAll<Row>(
      `SELECT f.id, f.transfer_date AS date, ${DIRECTION} AS direction, ${KIND} AS transfer_kind, ${STORES},
              f.partner_name AS partner, f.pieces, f.total_cost AS cost_total,
              CASE WHEN f.kind = 'sale' THEN f.total_price END AS transfer_price,
              CASE WHEN f.kind = 'sale' THEN f.paid END AS paid,
              CASE WHEN f.kind = 'sale' THEN MAX(0, ROUND(f.total_price - f.paid, 2)) END AS remaining,
              f.sale_id AS source_invoice, f.notes
       FROM (${sql}) f ORDER BY f.transfer_date DESC, f.id DESC`,
      params
    )
  }
}

/** سطر بكل منتج في كل تحويل (بعد اللي رجع للمصدر) */
export const transferItemsSheet: SheetDef = {
  key: 'transfer_items',
  columns: [
    col('transfer', 'number', 10), col('date', 'date'), col('direction', 'enum', 12), col('transfer_kind', 'enum', 14),
    col('from_store', 'enum', 24), col('to_store', 'enum', 24), col('name_ar', 'text', 24), col('name_en', 'text', 24),
    col('condition', 'enum', 10), col('quantity', 'number', 10), col('unit_cost', 'money'), col('unit_price', 'money'), col('line_total', 'money')
  ],
  rows: (p) => {
    const { sql, params } = filtered(filterOf(p))
    return queryAll<Row>(
      `SELECT f.id AS transfer, f.transfer_date AS date, ${DIRECTION} AS direction, ${KIND} AS transfer_kind, ${STORES},
              i.name_ar, i.name_en, ti.condition, ti.quantity - ti.returned_quantity AS quantity, ti.unit_cost, ti.unit_price,
              (ti.quantity - ti.returned_quantity) * ti.unit_price AS line_total
       FROM (${sql}) f JOIN transfer_items ti ON ti.transfer_id = f.id JOIN items i ON i.id = ti.from_item_id
       WHERE ti.quantity > ti.returned_quantity
       ORDER BY f.transfer_date DESC, f.id DESC, ti.id`,
      params
    )
  }
}
