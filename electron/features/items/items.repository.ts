import type { Item, Page, PageParams } from '@shared/types'
import { execute, queryAll, queryOne } from '../../database/connection'
import { queryPage } from '../../lib/pagination'
import { searchClause } from '../../lib/search'
import { activeWorkspaceId, inWorkspace } from '../../lib/workspace'
import { CONDITIONS } from '../../lib/constants'
import { ensureStock } from './stock.repository'

export interface ItemRowInput {
  category_id: number
  name_ar: string
  name_en: string | null
  search_text: string
}

const selectItems = () => `
  SELECT i.id, i.name_ar, i.name_en, i.category_id, c.name AS category_name, i.deleted_at,
         COALESCE(n.quantity, 0) AS new_quantity,
         COALESCE(n.purchase_price, 0) AS new_purchase_price,
         COALESCE(n.selling_price, 0) AS new_selling_price,
         COALESCE(n.wholesale_price, 0) AS new_wholesale_price,
         COALESCE(d.quantity, 0) AS damaged_quantity,
         COALESCE(d.purchase_price, 0) AS damaged_purchase_price,
         COALESCE(d.selling_price, 0) AS damaged_selling_price,
         COALESCE(d.wholesale_price, 0) AS damaged_wholesale_price
  FROM items i
  JOIN categories c ON c.id = i.category_id
  LEFT JOIN item_stock n ON n.item_id = i.id AND n.condition = 'new'
  LEFT JOIN item_stock d ON d.item_id = i.id AND d.condition = 'damaged'
  WHERE ${inWorkspace('i.workspace_id')}`

// ---------- المنتجات ----------

type ListOptions = { search?: string; category_id?: number }

function listQuery(opts: ListOptions) {
  const { where, params } = searchClause(['i.search_text', 'c.name'], opts.search, 'AND')
  const byCategory = opts.category_id ? 'AND i.category_id = @category_id' : ''
  const sql = `${selectItems()} AND i.deleted_at IS NULL ${byCategory} ${where} ORDER BY i.name_ar`
  return { sql, params: { ...params, category_id: opts.category_id } }
}

/** كل المنتجات النشطة (المؤرشفة مش بتظهر): للقوايم المنسدلة والتصدير ونسخ القايمة */
export function findAll(opts: ListOptions = {}): Item[] {
  const { sql, params } = listQuery(opts)
  return queryAll<Item>(sql, params)
}

/** صفحة واحدة من المنتجات */
export function findPage(opts: ListOptions, page: PageParams): Page<Item> {
  const { sql, params } = listQuery(opts)
  return queryPage<Item>(sql, params, page)
}

/** بيرجّع المنتج حتى لو مؤرشف (صفحة التفاصيل والفواتير القديمة محتاجاه) */
export const findById = (id: number) => queryOne<Item>(`${selectItems()} AND i.id = ?`, [id])

/**
 * منتج تاني بنفس الاسم (عربي أو إنجليزي، من غير تفرقة همزة/تاء مربوطة).
 * excludeId = المنتج نفسه وقت التعديل. المنتجات المؤرشفة مش بتتحسب.
 */
export function findDuplicate(names: string[], excludeId = 0): { id: number } | undefined {
  for (const n of names) {
    const hit = queryOne<{ id: number }>(
      `SELECT id FROM items
       WHERE ${inWorkspace('workspace_id')} AND deleted_at IS NULL AND id != @exclude AND (norm(name_ar) = norm(@n) OR norm(name_en) = norm(@n)) LIMIT 1`,
      { n, exclude: excludeId }
    )
    if (hit) return hit
  }
  return undefined
}

export function insert(data: ItemRowInput): number {
  const id = execute('INSERT INTO items(workspace_id, category_id, name_ar, name_en, search_text) VALUES (?, ?, ?, ?, ?)', [
    activeWorkspaceId(), data.category_id, data.name_ar, data.name_en, data.search_text
  ])
  for (const cond of CONDITIONS) ensureStock(id, cond)
  return id
}

export const update = (id: number, d: ItemRowInput) =>
  void execute(`UPDATE items SET category_id = ?, name_ar = ?, name_en = ?, search_text = ? WHERE id = ? AND ${inWorkspace('workspace_id')}`, [
    d.category_id, d.name_ar, d.name_en, d.search_text, id
  ])

export const remove = (id: number) => void execute(`DELETE FROM items WHERE id = ? AND ${inWorkspace('workspace_id')}`, [id])

/** إخفاء المنتج (بدل الحذف) لو له حركات */
export const archive = (id: number) =>
  void execute(`UPDATE items SET deleted_at = datetime('now','localtime') WHERE id = ? AND ${inWorkspace('workspace_id')}`, [id])

/** هل المنتج مستخدم في أي فاتورة أو مرتجع أو تحويل؟ */
export function hasHistory(id: number): boolean {
  return !!queryOne(
    `SELECT 1 FROM purchase_items WHERE item_id = @id
     UNION ALL SELECT 1 FROM sale_items WHERE item_id = @id
     UNION ALL SELECT 1 FROM return_items WHERE item_id = @id
     UNION ALL SELECT 1 FROM transfer_items WHERE from_item_id = @id OR to_item_id = @id LIMIT 1`,
    { id }
  )
}

/** صنف المنتج (بيتخزن في الفواتير). المنتج المؤرشف مينفعش يتباع أو يتشترى (إلا وقت تعديل فاتورة قديمة فيها). */
export const getMeta = (itemId: number, allowArchived = false) =>
  queryOne<{ item_id: number; category_id: number }>(
    `SELECT id AS item_id, category_id FROM items WHERE id = ? AND ${inWorkspace('workspace_id')} ${allowArchived ? '' : 'AND deleted_at IS NULL'}`,
    [itemId]
  )
