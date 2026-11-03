import type { Condition, Page, PageParams, PriceType, Sale, SaleLine, SaleWithLines, ShippingPayer } from '@shared/types'
import { execute, queryAll, queryOne } from '../../database/connection'
import { queryPage } from '../../lib/pagination'
import { searchClause } from '../../lib/search'
import { activeWorkspaceId, inWorkspace } from '../../lib/workspace'
import { findBySale } from '../payments/payments.repository'

export interface SaleHeaderInput {
  customer_id: number | null
  partner_id: number | null
  sale_date: string
  price_type: PriceType
  shipping_payer: ShippingPayer
  shipping_cost: number
  total: number
  notes: string | null
}

export interface SaleLineRow {
  sale_id: number
  item_id: number
  category_id: number
  condition: Condition
  quantity: number
  purchase_price: number
  selling_price: number
  source_workspace_id?: number | null
  source_item_id?: number | null
  transfer_price?: number | null
}

/** الفاتورة مع المدفوع والمرتجع والمتبقي (المتبقي = الإجمالي - المرتجع - المدفوع، مش أقل من صفر) */
const selectSales = () => `
  SELECT s.id, s.customer_id, cu.name AS customer_name, EXISTS(SELECT 1 FROM workspace_partners px WHERE px.customer_id = s.customer_id) AS customer_is_partner, s.partner_id, wp.name AS partner_name, s.sale_date, s.price_type, s.shipping_payer,
         s.shipping_cost, s.total, s.notes,
         ROUND(COALESCE((SELECT SUM(amount) FROM sale_payments WHERE sale_id = s.id), 0), 2) AS paid,
         ROUND(COALESCE((SELECT SUM(total) FROM returns WHERE sale_id = s.id), 0), 2) AS returns_total,
         MAX(0, ROUND(s.total - COALESCE((SELECT SUM(total) FROM returns WHERE sale_id = s.id), 0)
                              - COALESCE((SELECT SUM(amount) FROM sale_payments WHERE sale_id = s.id), 0), 2)) AS remaining
  FROM sales s LEFT JOIN customers cu ON cu.id = s.customer_id LEFT JOIN workspace_partners wp ON wp.id = s.partner_id
  WHERE ${inWorkspace('s.workspace_id')}`

type ListOptions = { search?: string; customerId?: number; partnerId?: number }

function listQuery(opts: ListOptions) {
  const { where, params } = searchClause(['customer_name', 'notes'], opts.search, 'AND')
  const byCustomer = opts.customerId ? 'AND customer_id = @customerId' : ''
  const byPartner = opts.partnerId ? 'AND partner_id = @partnerId' : ''
  const sql = `SELECT * FROM (${selectSales()}) WHERE 1 = 1 ${byCustomer} ${byPartner} ${where} ORDER BY sale_date DESC, id DESC`
  return { sql, params: { ...params, customerId: opts.customerId, partnerId: opts.partnerId } }
}

/** كل الفواتير (للقوايم المنسدلة وكشف حساب العميل) */
export function findAll(opts: ListOptions = {}): Sale[] {
  const { sql, params } = listQuery(opts)
  return queryAll<Sale>(sql, params)
}

/** صفحة واحدة من الفواتير */
export function findPage(opts: ListOptions, page: PageParams): Page<Sale> {
  const { sql, params } = listQuery(opts)
  return queryPage<Sale>(sql, params, page)
}

export function findById(id: number): SaleWithLines | null {
  const sale = queryOne<Sale>(`SELECT * FROM (${selectSales()}) WHERE id = ?`, [id])
  if (!sale) return null
  const items = queryAll<SaleLine>(
    `SELECT si.*, i.name_ar, i.name_en FROM sale_items si
     JOIN items i ON i.id = si.item_id WHERE si.sale_id = ? ORDER BY si.id`,
    [id]
  )
  return { ...sale, items, payments: findBySale(id) }
}

/** سطور الفاتورة زي ما اتسجلت (بنستخدمها لإرجاع الكميات للمخزن) */
export const findLineRows = (saleId: number) => queryAll<SaleLineRow>('SELECT * FROM sale_items WHERE sale_id = ? ORDER BY id', [saleId])

export const insertHeader = (h: SaleHeaderInput) =>
  execute(
    `INSERT INTO sales(workspace_id, customer_id, partner_id, sale_date, price_type, shipping_payer, shipping_cost, total, notes)
     VALUES (@workspace_id, @customer_id, @partner_id, @sale_date, @price_type, @shipping_payer, @shipping_cost, @total, @notes)`,
    { ...h, workspace_id: activeWorkspaceId() }
  )

export const updateHeader = (id: number, h: SaleHeaderInput) =>
  void execute(
    `UPDATE sales SET customer_id = @customer_id, partner_id = @partner_id, sale_date = @sale_date, price_type = @price_type,
       shipping_payer = @shipping_payer, shipping_cost = @shipping_cost, total = @total, notes = @notes WHERE id = @id`,
    { ...h, id }
  )

export const insertLine = (l: SaleLineRow) =>
  void execute(
    `INSERT INTO sale_items(sale_id, item_id, category_id, condition, quantity, purchase_price, selling_price, source_workspace_id, source_item_id, transfer_price)
     VALUES (@sale_id, @item_id, @category_id, @condition, @quantity, @purchase_price, @selling_price, @source_workspace_id, @source_item_id, @transfer_price)`,
    { ...l, source_workspace_id: l.source_workspace_id ?? null, source_item_id: l.source_item_id ?? null, transfer_price: l.transfer_price ?? null }
  )

/** الفاتورة اتعملت من تحويل للشريك (بتتعدّل وتتحذف من التحويل بس) */
export const isPartnerTransferSale = (saleId: number): boolean =>
  !!queryOne('SELECT 1 FROM transfers WHERE partner_sale_id = ?', [saleId])

export const deleteLines = (saleId: number) => void execute('DELETE FROM sale_items WHERE sale_id = ?', [saleId])
export const setTotal = (id: number, total: number) => void execute('UPDATE sales SET total = ? WHERE id = ?', [total, id])
/** حذف الفاتورة (سطورها ودفعاتها بتتحذف معاها) */
export const remove = (id: number) => void execute('DELETE FROM sales WHERE id = ?', [id])

export const returnsCount = (saleId: number): number =>
  queryOne<{ c: number }>('SELECT COUNT(*) AS c FROM returns WHERE sale_id = ?', [saleId])!.c
