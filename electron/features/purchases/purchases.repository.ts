import type { Condition, Page, PageParams, Purchase, PurchaseLine, PurchaseWithLines } from '@shared/types'
import { execute, queryAll, queryOne } from '../../database/connection'
import { queryPage } from '../../lib/pagination'
import { searchClause } from '../../lib/search'
import { activeWorkspaceId, inWorkspace, scoped } from '../../lib/workspace'

export interface PurchaseHeaderInput {
  supplier_name: string
  partner_id: number | null
  purchase_date: string
  shipping_cost: number
  total: number
  notes: string | null
}

export interface PurchaseLineRow {
  purchase_id: number
  item_id: number
  category_id: number
  condition: Condition
  quantity: number
  purchase_price: number
  landed_cost: number
  selling_price: number
  wholesale_price: number
}

type ListOptions = { search?: string; partnerId?: number }

/** الفاتورة واسم الشريك اللي اشترى */
const SELECT = 'SELECT p.*, wp.name AS partner_name FROM purchases p LEFT JOIN workspace_partners wp ON wp.id = p.partner_id'

function listQuery(opts: ListOptions) {
  const { where, params } = scoped('p.workspace_id', searchClause(['p.supplier_name', 'p.notes', 'wp.name'], opts.search))
  const byPartner = opts.partnerId ? 'AND p.partner_id = @partnerId' : ''
  return { sql: `${SELECT} ${where} ${byPartner} ORDER BY p.purchase_date DESC, p.id DESC`, params: { ...params, partnerId: opts.partnerId } }
}

/** كل الفواتير (للقوايم المنسدلة) */
export function findAll(opts: ListOptions = {}): Purchase[] {
  const { sql, params } = listQuery(opts)
  return queryAll<Purchase>(sql, params)
}

/** صفحة واحدة من الفواتير */
export function findPage(opts: ListOptions, page: PageParams): Page<Purchase> {
  const { sql, params } = listQuery(opts)
  return queryPage<Purchase>(sql, params, page)
}

export function findById(id: number): PurchaseWithLines | null {
  const purchase = queryOne<Purchase>(`${SELECT} WHERE p.id = ? AND ${inWorkspace('p.workspace_id')}`, [id])
  if (!purchase) return null
  const items = queryAll<PurchaseLine>(
    `SELECT pi.*, i.name_ar, i.name_en FROM purchase_items pi
     JOIN items i ON i.id = pi.item_id WHERE pi.purchase_id = ? ORDER BY pi.id`,
    [id]
  )
  return { ...purchase, items }
}

/** سطور الفاتورة زي ما اتسجلت (بنستخدمها لخصم الكميات من المخزن عند التعديل والحذف) */
export const findLineRows = (purchaseId: number) =>
  queryAll<PurchaseLineRow>('SELECT * FROM purchase_items WHERE purchase_id = ? ORDER BY id', [purchaseId])

export const updateHeader = (id: number, h: PurchaseHeaderInput) =>
  void execute(
    `UPDATE purchases SET supplier_name = @supplier_name, partner_id = @partner_id, purchase_date = @purchase_date,
       shipping_cost = @shipping_cost, total = @total, notes = @notes WHERE id = @id`,
    { ...h, id }
  )

export const deleteLines = (purchaseId: number) => void execute('DELETE FROM purchase_items WHERE purchase_id = ?', [purchaseId])
/** حذف الفاتورة (سطورها بتتحذف معاها) */
export const remove = (id: number) => void execute('DELETE FROM purchases WHERE id = ?', [id])

export const returnsCount = (purchaseId: number): number =>
  queryOne<{ c: number }>('SELECT COUNT(*) AS c FROM returns WHERE purchase_id = ?', [purchaseId])!.c

export const insertHeader = (h: PurchaseHeaderInput) =>
  execute(
    `INSERT INTO purchases(workspace_id, supplier_name, partner_id, purchase_date, shipping_cost, total, notes)
     VALUES (@workspace_id, @supplier_name, @partner_id, @purchase_date, @shipping_cost, @total, @notes)`,
    { ...h, workspace_id: activeWorkspaceId() }
  )

export const insertLine = (l: PurchaseLineRow) =>
  void execute(
    `INSERT INTO purchase_items(purchase_id, item_id, category_id, condition,
       quantity, purchase_price, landed_cost, selling_price, wholesale_price)
     VALUES (@purchase_id, @item_id, @category_id, @condition,
       @quantity, @purchase_price, @landed_cost, @selling_price, @wholesale_price)`,
    { ...l }
  )
