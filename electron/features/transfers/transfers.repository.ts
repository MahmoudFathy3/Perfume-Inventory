import type { Condition, Page, PageParams, Transfer, TransferKind, TransferRecipient, TransferLine, TransferMoneyLine, TransfersFilter, TransferSummaryRow } from '@shared/types'
import { execute, queryAll, queryOne } from '../../database/connection'
import { queryPage } from '../../lib/pagination'
import { searchClause } from '../../lib/search'
import { activeWorkspaceId } from '../../lib/workspace'

export interface NewTransfer {
  from_workspace_id: number
  to_workspace_id: number
  kind: TransferKind
  partner_id: number | null
  transfer_date: string
  total_cost: number
  total_price: number
  notes: string | null
  /** تحويل تلقائي لفاتورة بيع */
  sale_id?: number | null
  recipient?: TransferRecipient | null
  /** التحويل للشريك: فاتورته في المخزون الفعلي */
  partner_sale_id?: number | null
}

export interface NewTransferLine {
  transfer_id: number
  from_item_id: number
  to_item_id: number
  condition: Condition
  quantity: number
  unit_cost: number
  unit_price: number
}

/** سطر التحويل زي ما هو متخزن (بيستخدمه العكس عند الحذف). quantity = اللي فاضل بعد اللي رجع للمصدر */
export interface TransferLineRow {
  id: number
  from_item_id: number
  to_item_id: number
  condition: Condition
  quantity: number
  unit_cost: number
  unit_price: number
}

const SELECT = `
  SELECT t.id, t.from_workspace_id, t.to_workspace_id, t.kind, t.partner_id, p.name AS partner_name,
         t.transfer_date, t.total_cost, t.total_price, t.notes, t.sale_id, t.recipient, t.partner_sale_id,
         (SELECT COALESCE(SUM(quantity - returned_quantity), 0) FROM transfer_items WHERE transfer_id = t.id) AS pieces,
         (SELECT ROUND(COALESCE(ABS(SUM(amount)), 0), 2) FROM partner_payments WHERE transfer_id = t.id) AS paid
  FROM transfers t LEFT JOIN workspace_partners p ON p.id = t.partner_id`

/** فرق التقريب في المقارنة بين المدفوع والإجمالي */
const EPS = 0.005

// أسماء منتجات التحويل في عمود واحد علشان البحث يلاقي التحويل باسم أي منتج فيه
const ITEM_NAMES = `(SELECT group_concat(i.name_ar || ' ' || COALESCE(i.name_en, ''), ' ')
   FROM transfer_items ti JOIN items i ON i.id = ti.from_item_id WHERE ti.transfer_id = t.id)`

/** التحويلات اللي المخزن النشط طرف فيها (طالع منه أو داخل عليه) بعد الفلتر، من غير ترتيب */
function filtered(filter: TransfersFilter) {
  const { where, params } = searchClause(['partner_name', 'notes', 'item_names'], filter.search, 'AND')
  const conditions = [
    filter.kind ? 'AND kind = @kind' : '',
    filter.direction === 'out' ? 'AND from_workspace_id = @ws' : filter.direction === 'in' ? 'AND to_workspace_id = @ws' : '',
    filter.from ? 'AND transfer_date >= @from' : '',
    filter.to ? 'AND transfer_date <= @to' : '',
    filter.payment === 'paid' ? `AND kind = 'sale' AND paid >= total_price - ${EPS}` : '',
    filter.payment === 'unpaid' ? `AND kind = 'sale' AND paid < total_price - ${EPS}` : ''
  ].join(' ')
  const sql = `SELECT * FROM (
      SELECT t.*, ${ITEM_NAMES} AS item_names FROM (${SELECT}) t
      WHERE t.from_workspace_id = @ws OR t.to_workspace_id = @ws
    ) WHERE 1 = 1 ${conditions} ${where}`
  return { sql, params: { ...params, ws: activeWorkspaceId(), kind: filter.kind, from: filter.from, to: filter.to } }
}

/** صفحة من التحويلات اللي المخزن النشط طرف فيها، بالفلتر */
export function findPage(filter: TransfersFilter, page: PageParams): Page<Transfer> {
  const { sql, params } = filtered(filter)
  return queryPage<Transfer>(`${sql} ORDER BY transfer_date DESC, id DESC`, params, page)
}

/** عدد القطع والتحويلات لكل اتجاه + شخص + نوع (بنفس الفلتر) */
export function summary(filter: TransfersFilter): TransferSummaryRow[] {
  const { sql, params } = filtered(filter)
  return queryAll<TransferSummaryRow>(
    `SELECT CASE WHEN from_workspace_id = @ws THEN 'out' ELSE 'in' END AS direction,
            -- "للشراكة (بالنص)" ملوش شخص حتى لو متسجل باسم صاحب المخزون
            CASE WHEN recipient = 'partnership' THEN NULL ELSE partner_id END AS partner_id,
            CASE WHEN recipient = 'partnership' THEN NULL ELSE partner_name END AS partner_name, kind,
            COUNT(*) AS transfers, SUM(pieces) AS pieces,
            ROUND(SUM(total_cost), 2) AS total_cost, ROUND(SUM(total_price), 2) AS total_price
     FROM (${sql})
     GROUP BY direction, CASE WHEN recipient = 'partnership' THEN NULL ELSE partner_id END, kind
     ORDER BY direction DESC, pieces DESC`,
    params
  )
}

export const findById = (id: number) => queryOne<Transfer>(`${SELECT} WHERE t.id = ?`, [id])

/** سطور التحويل بأسماء المنتجات (من جهة المصدر) للعرض */
export const findLines = (transferId: number) =>
  queryAll<TransferLine>(
    `SELECT ti.id, ti.from_item_id, i.name_ar AS item_name, ti.condition, ti.quantity - ti.returned_quantity AS quantity, ti.unit_cost, ti.unit_price
     FROM transfer_items ti JOIN items i ON i.id = ti.from_item_id WHERE ti.transfer_id = ? AND ti.quantity > ti.returned_quantity ORDER BY ti.id`,
    [transferId]
  )

export const findLineRows = (transferId: number) =>
  queryAll<TransferLineRow>(
    `SELECT id, from_item_id, to_item_id, condition, quantity - returned_quantity AS quantity, unit_cost, unit_price
     FROM transfer_items WHERE transfer_id = ? AND quantity > returned_quantity ORDER BY id`,
    [transferId]
  )

export const insertHeader = (h: NewTransfer): number =>
  execute(
    `INSERT INTO transfers(from_workspace_id, to_workspace_id, kind, partner_id, transfer_date, total_cost, total_price, notes, sale_id, recipient, partner_sale_id)
     VALUES (@from_workspace_id, @to_workspace_id, @kind, @partner_id, @transfer_date, @total_cost, @total_price, @notes, @sale_id, @recipient, @partner_sale_id)`,
    { ...h, sale_id: h.sale_id ?? null, recipient: h.recipient ?? null, partner_sale_id: h.partner_sale_id ?? null }
  )

export const insertLine = (l: NewTransferLine) =>
  void execute(
    `INSERT INTO transfer_items(transfer_id, from_item_id, to_item_id, condition, quantity, unit_cost, unit_price)
     VALUES (@transfer_id, @from_item_id, @to_item_id, @condition, @quantity, @unit_cost, @unit_price)`,
    { ...l }
  )

export const updateHeader = (id: number, h: NewTransfer) =>
  void execute(
    `UPDATE transfers SET from_workspace_id = @from_workspace_id, to_workspace_id = @to_workspace_id, kind = @kind, partner_id = @partner_id,
       transfer_date = @transfer_date, total_cost = @total_cost, total_price = @total_price, notes = @notes,
       recipient = @recipient, partner_sale_id = @partner_sale_id WHERE id = @id`,
    { ...h, id, recipient: h.recipient ?? null, partner_sale_id: h.partner_sale_id ?? null }
  )

export const deleteLines = (transferId: number) => void execute('DELETE FROM transfer_items WHERE transfer_id = ?', [transferId])

/** التحويلات (بيع بسعر) اللي المخزن طرف فيها، علشان نحسب الفلوس اللي لينا واللي علينا */
export const findSales = (workspaceId: number) =>
  queryAll<Transfer>(`SELECT * FROM (${SELECT}) WHERE kind = 'sale' AND (from_workspace_id = @ws OR to_workspace_id = @ws) ORDER BY transfer_date, id`, { ws: workspaceId })

export const emptyMoneyLine = (): TransferMoneyLine => ({ total: 0, paid: 0, remaining: 0, unpaid_count: 0 })
export const isUnpaid = (t: Transfer) => t.paid < t.total_price - EPS

export const remove = (id: number) => void execute('DELETE FROM transfers WHERE id = ?', [id])

// ---------- التحويلات التلقائية لفواتير البيع ----------
/** تحويلات فاتورة بيع (اللي اتعملت للسطور الجاية من مخزن تاني) */
export const findBySale = (saleId: number) => queryAll<Transfer>(`SELECT * FROM (${SELECT}) WHERE sale_id = ? ORDER BY id`, [saleId])

/** سطور تحويلات الفاتورة لمنتج معين في مخزنها (علشان المرتجع للمصدر). quantity = الفاضل، returned = اللي رجع */
export const saleTransferLines = (saleId: number, toItemId: number, condition: Condition) =>
  queryAll<TransferLineRow & { transfer_id: number; from_workspace_id: number; returned: number }>(
    `SELECT ti.id, ti.transfer_id, t.from_workspace_id, ti.from_item_id, ti.to_item_id, ti.condition,
            ti.quantity - ti.returned_quantity AS quantity, ti.returned_quantity AS returned, ti.unit_cost, ti.unit_price
     FROM transfer_items ti JOIN transfers t ON t.id = ti.transfer_id
     WHERE t.sale_id = ? AND ti.to_item_id = ? AND ti.condition = ? ORDER BY ti.id`,
    [saleId, toItemId, condition]
  )

/** القطع اللي رجعت للمصدر من سطر تحويل (موجب = رجعت، سالب = إلغاء الرجوع) */
export const addReturned = (lineId: number, quantity: number) =>
  void execute('UPDATE transfer_items SET returned_quantity = returned_quantity + ? WHERE id = ?', [quantity, lineId])

/** إجماليات التحويل من سطوره (بعد اللي رجع للمصدر) */
export const recalcTotals = (transferId: number) =>
  void execute(
    `UPDATE transfers SET
       total_cost = (SELECT ROUND(COALESCE(SUM((quantity - returned_quantity) * unit_cost), 0), 2) FROM transfer_items WHERE transfer_id = @id),
       total_price = (SELECT ROUND(COALESCE(SUM((quantity - returned_quantity) * unit_price), 0), 2) FROM transfer_items WHERE transfer_id = @id)
     WHERE id = @id`,
    { id: transferId }
  )
