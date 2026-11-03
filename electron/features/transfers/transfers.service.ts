import type { Item, PageParams, TransferDetails, TransferFilter, TransferInput } from '@shared/types'
import { getDb } from '../../database/connection'
import { AppError, round2 } from '../../lib/errors'
import { withWorkspace } from '../../lib/workspace'
import * as itemsRepo from '../items/items.repository'
import * as workspaces from '../workspaces/workspaces.repository'
import * as repo from './transfers.repository'
import { putIn, reverse, takeOut } from './transfers.stock'
import { cleanTransfer } from './transfers.validation'
import type { CleanTransfer } from './transfers.validation'

export const pageTransfers = (p: TransferFilter & PageParams) => repo.findPage(p, p)

export function getTransfer({ id }: { id: number }): TransferDetails {
  const transfer = repo.findById(id)
  if (!transfer) throw new AppError('TRANSFER_NOT_FOUND')
  return { ...transfer, items: repo.findLines(id) }
}

/** منتجات مخزن تاني (علشان نختار منها وإحنا واقفين في مخزن مختلف) */
export function listSourceItems({ workspace_id }: { workspace_id: number }): Item[] {
  if (!workspaces.findById(workspace_id)) throw new AppError('WORKSPACE_NOT_FOUND')
  return withWorkspace(workspace_id, () => itemsRepo.findAll())
}

/** بينقل القطع ويسجّل التحويل: جديد (existingId = undefined) أو مكان تحويل قديم اتعكس (التعديل) */
function apply(c: CleanTransfer, existingId?: number): number {
  const out = takeOut(c)
  const toItemIds = putIn(c.to, out)

  const header = {
    from_workspace_id: c.from,
    to_workspace_id: c.to,
    kind: c.kind,
    partner_id: c.partnerId,
    transfer_date: c.date,
    total_cost: round2(out.reduce((sum, l) => sum + l.quantity * l.unit_cost, 0)),
    total_price: round2(out.reduce((sum, l) => sum + l.quantity * l.unit_price, 0)),
    notes: c.notes
  }
  const id = existingId ?? repo.insertHeader(header)
  if (existingId) repo.updateHeader(id, header)
  out.forEach((l, i) =>
    repo.insertLine({
      transfer_id: id,
      from_item_id: l.from_item_id,
      to_item_id: toItemIds[i],
      condition: l.condition,
      quantity: l.quantity,
      unit_cost: l.unit_cost,
      unit_price: l.unit_price
    })
  )
  return id
}

/** تحويل قطع بين المخزون الفعلي وشراكة (في أي اتجاه) */
export const createTransfer = (input: TransferInput): number => getDb().transaction(() => apply(cleanTransfer(input)))()

/**
 * تعديل تحويل: بنعكس القديم (القطع ترجع لمصدرها) وبننفّذ الجديد بنفس الرقم.
 * لو الوجهة باعت أو استهلكت القطع القديمة بيترفض (OUT_OF_STOCK) زي الحذف بالظبط.
 */
export const updateTransfer = ({ id, ...input }: TransferInput & { id: number }): void =>
  getDb().transaction(() => {
    const old = repo.findById(id)
    if (!old) throw new AppError('TRANSFER_NOT_FOUND')
    reverse(old.from_workspace_id, old.to_workspace_id, repo.findLineRows(id))
    repo.deleteLines(id)
    apply(cleanTransfer(input), id)
  })()

/** حذف التحويل = عكسه. لو الوجهة باعت القطع أو استهلكتها بيترفض (OUT_OF_STOCK). */
export const removeTransfer = ({ id }: { id: number }): void =>
  getDb().transaction(() => {
    const transfer = repo.findById(id)
    if (!transfer) throw new AppError('TRANSFER_NOT_FOUND')
    reverse(transfer.from_workspace_id, transfer.to_workspace_id, repo.findLineRows(id))
    repo.remove(id)
  })()
