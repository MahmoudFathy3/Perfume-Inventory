import type { Condition, Page, PageParams, ReturnKind, ReturnLine, ReturnRecord, ReturnWithLines } from '@shared/types'
import { execute, queryAll, queryOne } from '../../database/connection'
import { queryPage } from '../../lib/pagination'
import { searchClause } from '../../lib/search'
import { saleCredit, saleRemaining } from '../../lib/salePaid'
import { activeWorkspaceId, inWorkspace, scoped } from '../../lib/workspace'

export interface ReturnHeaderInput {
  type: ReturnKind
  sale_id: number | null
  purchase_id: number | null
  return_date: string
  reason: string | null
  total: number
}

export interface ReturnLineRow {
  return_id: number
  item_id: number
  quantity: number
  unit_price: number
  condition: Condition
  /** 1 = رجع للمخزن الأصلي (القطع كانت جاية من مخزن تاني في الفاتورة) */
  to_source?: number
}

type ListOptions = { search?: string }

function listQuery(opts: ListOptions) {
  const { where, params } = scoped('r.workspace_id', searchClause(['r.reason', 'cu.name', 'p.supplier_name'], opts.search))
  const sql = `SELECT r.*, cu.name AS customer_name, EXISTS(SELECT 1 FROM workspace_partners px WHERE px.customer_id = s.customer_id) AS customer_is_partner, p.supplier_name, ROUND(COALESCE((SELECT SUM(amount) FROM sale_refunds WHERE return_id = r.id AND kind = 'cash'), 0), 2) AS refunded,
       CASE WHEN s.id IS NULL THEN NULL ELSE ${saleRemaining('s.id', 's.total')} END AS sale_remaining,
       CASE WHEN s.id IS NULL THEN NULL ELSE ${saleCredit('s.id', 's.total')} END AS sale_credit FROM returns r
     LEFT JOIN sales s ON s.id = r.sale_id
     LEFT JOIN customers cu ON cu.id = s.customer_id
     LEFT JOIN purchases p ON p.id = r.purchase_id
     ${where} ORDER BY r.return_date DESC, r.id DESC`
  return { sql, params }
}

export function findAll(opts: ListOptions = {}): ReturnRecord[] {
  const { sql, params } = listQuery(opts)
  return queryAll<ReturnRecord>(sql, params)
}

/** صفحة واحدة من المرتجعات */
export function findPage(opts: ListOptions, page: PageParams): Page<ReturnRecord> {
  const { sql, params } = listQuery(opts)
  return queryPage<ReturnRecord>(sql, params, page)
}

export function findById(id: number): ReturnWithLines | null {
  const record = queryOne<ReturnRecord>(
    `SELECT r.*, cu.name AS customer_name, EXISTS(SELECT 1 FROM workspace_partners px WHERE px.customer_id = s.customer_id) AS customer_is_partner, p.supplier_name, ROUND(COALESCE((SELECT SUM(amount) FROM sale_refunds WHERE return_id = r.id AND kind = 'cash'), 0), 2) AS refunded,
       CASE WHEN s.id IS NULL THEN NULL ELSE ${saleRemaining('s.id', 's.total')} END AS sale_remaining,
       CASE WHEN s.id IS NULL THEN NULL ELSE ${saleCredit('s.id', 's.total')} END AS sale_credit FROM returns r
     LEFT JOIN sales s ON s.id = r.sale_id LEFT JOIN customers cu ON cu.id = s.customer_id
     LEFT JOIN purchases p ON p.id = r.purchase_id WHERE r.id = ? AND ${inWorkspace('r.workspace_id')}`,
    [id]
  )
  if (!record) return null
  const items = queryAll<ReturnLine>(
    `SELECT ri.*, i.name_ar, i.name_en FROM return_items ri
     JOIN items i ON i.id = ri.item_id WHERE ri.return_id = ? ORDER BY ri.id`,
    [id]
  )
  return { ...record, items }
}

export const insertHeader = (h: ReturnHeaderInput) =>
  execute(
    `INSERT INTO returns(workspace_id, type, sale_id, purchase_id, return_date, reason, total)
     VALUES (@workspace_id, @type, @sale_id, @purchase_id, @return_date, @reason, @total)`,
    { ...h, workspace_id: activeWorkspaceId() }
  )

export const insertLine = (l: ReturnLineRow) =>
  void execute(
    `INSERT INTO return_items(return_id, item_id, quantity, unit_price, condition, to_source)
     VALUES (@return_id, @item_id, @quantity, @unit_price, @condition, @to_source)`,
    { ...l, to_source: l.to_source ?? 0 }
  )

/** سطور المرتجع زي ما اتسجلت (بنستخدمها لعكس تأثيره على المخزن عند الحذف) */
export const findLineRows = (returnId: number) =>
  queryAll<ReturnLineRow>('SELECT * FROM return_items WHERE return_id = ? ORDER BY id', [returnId])

/** حذف المرتجع (سطوره بتتحذف معاه) */
export const remove = (id: number) => void execute('DELETE FROM returns WHERE id = ?', [id])

export const setTotal = (id: number, total: number) => void execute('UPDATE returns SET total = ? WHERE id = ?', [total, id])

/** اللي اتباع/اتشترى في الفاتورة */
export function originalQuantity(type: ReturnKind, invoiceId: number, itemId: number): number {
  const table = type === 'sale' ? 'sale_items' : 'purchase_items'
  const col = type === 'sale' ? 'sale_id' : 'purchase_id'
  return queryOne<{ q: number }>(`SELECT COALESCE(SUM(quantity), 0) AS q FROM ${table} WHERE ${col} = ? AND item_id = ?`, [invoiceId, itemId])!.q
}

/** اللي اترجع من الفاتورة قبل كده (علشان المرتجع ميزيدش عن الأصل) */
export function returnedQuantity(type: ReturnKind, invoiceId: number, itemId: number): number {
  const col = type === 'sale' ? 'sale_id' : 'purchase_id'
  return queryOne<{ q: number }>(
    `SELECT COALESCE(SUM(ri.quantity), 0) AS q FROM return_items ri
     JOIN returns r ON r.id = ri.return_id WHERE r.${col} = ? AND ri.item_id = ?`,
    [invoiceId, itemId]
  )!.q
}

/** تكلفة القطعة وقت البيع / في فاتورة الشراء: بندوّر بنفس الحالة الأول، ولو مش موجودة بنستخدم أي سطر للمنتج */
function lineCost(table: string, column: string, invoiceColumn: string, invoiceId: number, itemId: number, condition: Condition): number {
  const sql = (extra: string) =>
    `SELECT SUM(quantity * ${column}) * 1.0 / SUM(quantity) AS c FROM ${table} WHERE ${invoiceColumn} = ? AND item_id = ? ${extra}`
  const same = queryOne<{ c: number | null }>(sql('AND condition = ?'), [invoiceId, itemId, condition])?.c
  if (same !== null && same !== undefined) return same
  return queryOne<{ c: number | null }>(sql(''), [invoiceId, itemId])?.c ?? 0
}

export const saleLineCost = (saleId: number, itemId: number, c: Condition) => lineCost('sale_items', 'purchase_price', 'sale_id', saleId, itemId, c)
export const purchaseLineCost = (purchaseId: number, itemId: number, c: Condition) =>
  lineCost('purchase_items', 'landed_cost', 'purchase_id', purchaseId, itemId, c)
