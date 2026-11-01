import type { Condition, Page, PageParams, Transfer, TransferKind, TransferLine } from '@shared/types'
import { execute, queryAll, queryOne } from '../../database/connection'
import { queryPage } from '../../lib/pagination'
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

/** سطر التحويل زي ما هو متخزن (بيستخدمه العكس عند الحذف) */
export interface TransferLineRow {
  from_item_id: number
  to_item_id: number
  condition: Condition
  quantity: number
  unit_cost: number
  unit_price: number
}

const SELECT = `
  SELECT t.id, t.from_workspace_id, t.to_workspace_id, t.kind, t.partner_id, p.name AS partner_name,
         t.transfer_date, t.total_cost, t.total_price, t.notes,
         (SELECT COALESCE(SUM(quantity), 0) FROM transfer_items WHERE transfer_id = t.id) AS pieces
  FROM transfers t LEFT JOIN workspace_partners p ON p.id = t.partner_id`

/** صفحة من التحويلات اللي المخزن النشط طرف فيها (طالع منه أو داخل عليه) */
export function findPage(page: PageParams): Page<Transfer> {
  return queryPage<Transfer>(
    `${SELECT} WHERE t.from_workspace_id = @ws OR t.to_workspace_id = @ws ORDER BY t.transfer_date DESC, t.id DESC`,
    { ws: activeWorkspaceId() },
    page
  )
}

export const findById = (id: number) => queryOne<Transfer>(`${SELECT} WHERE t.id = ?`, [id])

/** سطور التحويل بأسماء المنتجات (من جهة المصدر) للعرض */
export const findLines = (transferId: number) =>
  queryAll<TransferLine>(
    `SELECT ti.id, i.name_ar AS item_name, ti.condition, ti.quantity, ti.unit_cost, ti.unit_price
     FROM transfer_items ti JOIN items i ON i.id = ti.from_item_id WHERE ti.transfer_id = ? ORDER BY ti.id`,
    [transferId]
  )

export const findLineRows = (transferId: number) =>
  queryAll<TransferLineRow>(
    'SELECT from_item_id, to_item_id, condition, quantity, unit_cost, unit_price FROM transfer_items WHERE transfer_id = ?',
    [transferId]
  )

export const insertHeader = (h: NewTransfer): number =>
  execute(
    `INSERT INTO transfers(from_workspace_id, to_workspace_id, kind, partner_id, transfer_date, total_cost, total_price, notes)
     VALUES (@from_workspace_id, @to_workspace_id, @kind, @partner_id, @transfer_date, @total_cost, @total_price, @notes)`,
    { ...h }
  )

export const insertLine = (l: NewTransferLine) =>
  void execute(
    `INSERT INTO transfer_items(transfer_id, from_item_id, to_item_id, condition, quantity, unit_cost, unit_price)
     VALUES (@transfer_id, @from_item_id, @to_item_id, @condition, @quantity, @unit_cost, @unit_price)`,
    { ...l }
  )

export const remove = (id: number) => void execute('DELETE FROM transfers WHERE id = ?', [id])
