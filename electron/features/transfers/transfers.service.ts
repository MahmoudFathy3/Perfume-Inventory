import type { Item, PageParams, TransferDetails, TransferInput, TransfersFilter } from '@shared/types'
import { getDb } from '../../database/connection'
import { AppError, round2 } from '../../lib/errors'
import { withWorkspace } from '../../lib/workspace'
import * as itemsRepo from '../items/items.repository'
import * as workspaces from '../workspaces/workspaces.repository'
import * as repo from './transfers.repository'
import { putIn, returnToSource, reverse, takeBackFromDestination, takeOut } from './transfers.stock'
import type { OutgoingLine } from './transfers.stock'
import { cleanTransfer } from './transfers.validation'
import type { CleanTransfer } from './transfers.validation'

export const pageTransfers = (p: TransfersFilter & PageParams) => repo.findPage(p, p)

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

const header = (c: CleanTransfer, out: OutgoingLine[]): repo.NewTransfer => ({
  from_workspace_id: c.from,
  to_workspace_id: c.to,
  kind: c.kind,
  partner_id: c.partnerId,
  transfer_date: c.date,
  total_cost: round2(out.reduce((sum, l) => sum + l.quantity * l.unit_cost, 0)),
  total_price: round2(out.reduce((sum, l) => sum + l.quantity * l.unit_price, 0)),
  notes: c.notes
})

function insertLines(id: number, out: OutgoingLine[], toItemIds: number[]): void {
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
}

/** تحويل قطع بين المخزون الفعلي وشراكة (في أي اتجاه) */
export const createTransfer = (input: TransferInput): number =>
  getDb().transaction(() => {
    const c = cleanTransfer(input)
    const out = takeOut(c)
    const id = repo.insertHeader(header(c, out))
    insertLines(id, out, putIn(c.to, out))
    return id
  })()

/**
 * تعديل التحويل (أي حاجة فيه: الاتجاه، النوع، الشريك، المنتجات، الكميات، الأسعار).
 * العادي: بنعكس القديم كله وبعدين نعمل الجديد (المتوسطات بترجع بالظبط).
 * لو الوجهة باعت جزء من القطع (العكس الكامل مش ممكن): القديم بيرجع للمصدر، والجديد بيتعمل، وفي الآخر القديم بيخرج من الوجهة.
 * كده تعديل سعر أو ملاحظة بيشتغل حتى لو اتباع جزء، والرفض (OUT_OF_STOCK) بس لو الكمية الجديدة أقل من اللي اتباع.
 */
export const updateTransfer = ({ id, ...input }: TransferInput & { id: number }): void =>
  getDb().transaction(() => {
    const old = repo.findById(id)
    if (!old) throw new AppError('TRANSFER_NOT_FOUND')
    for (const wsId of [old.from_workspace_id, old.to_workspace_id]) {
      if (workspaces.findById(wsId)?.closed_at) throw new AppError('WORKSPACE_CLOSED')
    }
    const oldLines = repo.findLineRows(id)
    const c = cleanTransfer(input)

    let reversed = true
    try {
      getDb().transaction(() => reverse(old.from_workspace_id, old.to_workspace_id, oldLines))() // savepoint: لو فشل مبيسيبش أثر
    } catch (e) {
      if (!(e instanceof AppError) || e.code !== 'OUT_OF_STOCK') throw e
      reversed = false
      returnToSource(old.from_workspace_id, oldLines)
    }
    const out = takeOut(c)
    const toItemIds = putIn(c.to, out)
    if (!reversed) takeBackFromDestination(old.to_workspace_id, oldLines)

    repo.deleteLines(id)
    repo.updateHeader(id, header(c, out))
    insertLines(id, out, toItemIds)
  })()

/** حذف التحويل = عكسه. لو الوجهة باعت القطع أو استهلكتها بيترفض (OUT_OF_STOCK). */
export const removeTransfer = ({ id }: { id: number }): void =>
  getDb().transaction(() => {
    const transfer = repo.findById(id)
    if (!transfer) throw new AppError('TRANSFER_NOT_FOUND')
    reverse(transfer.from_workspace_id, transfer.to_workspace_id, repo.findLineRows(id))
    repo.remove(id)
  })()
