import type { PageParams, PurchaseInput } from '@shared/types'
import { getDb } from '../../database/connection'
import { AppError } from '../../lib/errors'
import * as repo from './purchases.repository'
import { receiveLines, releaseLines } from './purchases.stock'
import { cleanPurchase } from './purchases.validation'
import type { CleanPurchase } from './purchases.validation'

type PurchasesFilter = { search?: string; partnerId?: number }
export const listPurchases = (p: PurchasesFilter) => repo.findAll(p)
export const pagePurchases = (p: PurchasesFilter & PageParams) => repo.findPage(p, p)
export const getPurchase = ({ id }: { id: number }) => repo.findById(id)

const header = (c: CleanPurchase) => ({
  supplier_name: c.supplier_name,
  partner_id: c.partnerId,
  paid_by_partner: c.paidByPartner ? 1 : 0,
  purchase_date: c.date,
  shipping_cost: c.shipping,
  total: c.total,
  notes: c.notes
})

export function createPurchase(input: PurchaseInput): number {
  const c = cleanPurchase(input)
  return getDb().transaction(() => {
    const id = repo.insertHeader(header(c))
    receiveLines(id, c, false, () => true)
    return id
  })()
}

/**
 * تعديل فاتورة شراء: بنضيف السطور الجديدة للمخزن وبعدها بنخصم القديمة (ده بيحافظ على متوسط التكلفة صح).
 * لو كمية اتباعت منها بيرفض (OUT_OF_STOCK). مينفعش لو عليها مرتجعات (احذف المرتجع الأول).
 * أسعار البيع والجملة على المنتجات الموجودة مبتتغيرش من التعديل.
 */
export function updatePurchase({ id, ...input }: PurchaseInput & { id: number }): void {
  const c = cleanPurchase(input)
  getDb().transaction(() => {
    if (!repo.findById(id)) throw new AppError('PURCHASE_NOT_FOUND')
    if (repo.returnsCount(id) > 0) throw new AppError('HAS_RETURNS')

    const old = repo.findLineRows(id)
    repo.deleteLines(id)
    repo.updateHeader(id, header(c))
    receiveLines(id, c, true, (created) => created)
    releaseLines(old)
  })()
}

/** حذف فاتورة شراء: الكميات بتتخصم من المخزن (لو اتباعت منها بيرفض). مينفعش لو عليها مرتجعات. */
export function removePurchase({ id }: { id: number }): void {
  getDb().transaction(() => {
    if (!repo.findById(id)) throw new AppError('PURCHASE_NOT_FOUND')
    if (repo.returnsCount(id) > 0) throw new AppError('HAS_RETURNS')
    releaseLines(repo.findLineRows(id))
    repo.remove(id)
  })()
}
