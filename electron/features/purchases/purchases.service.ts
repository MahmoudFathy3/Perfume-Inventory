import type { DateFilter, PageParams, PurchaseInput, PurchasePaymentInput } from '@shared/types'
import { getDb } from '../../database/connection'
import { AppError, money, positiveAmount, round2, today } from '../../lib/errors'
import { assertOpen, assertPurchaseOpen, assertPurchasePaymentOpen } from '../../lib/monthLock'
import * as repo from './purchases.repository'
import { receiveLines, releaseLines } from './purchases.stock'
import { cleanPurchase } from './purchases.validation'
import type { CleanPurchase } from './purchases.validation'

const EPS = 0.005
type PurchasesFilter = { search?: string; partnerId?: number } & DateFilter
export const listPurchases = (p: PurchasesFilter) => repo.findAll(p)
export const pagePurchases = (p: PurchasesFilter & PageParams) => repo.findPage(p, p)
export const getPurchase = ({ id }: { id: number }) => repo.findById(id)

const header = (c: CleanPurchase) => ({
  supplier_name: c.supplier_name,
  partner_id: c.partnerId,
  joint: c.joint ? 1 : 0,
  paid_by_partner: c.paidByPartner ? 1 : 0,
  purchase_date: c.date,
  shipping_cost: c.shipping,
  total: c.total,
  notes: c.notes
})

/**
 * فاتورة شراء جديدة. paid = المدفوع للمورد وقت الشراء (الافتراضي الفاتورة كلها)، والباقي بيتدفع بعد كده.
 * اللي الشريك دفعها من جيبه ملهاش دفعات للمورد (الشراكة مدينة للشريك).
 */
export function createPurchase(input: PurchaseInput): number {
  const c = cleanPurchase(input)
  assertOpen(c.date)
  return getDb().transaction(() => {
    const id = repo.insertHeader(header(c))
    receiveLines(id, c, false, () => true)
    if (c.paidByPartner) return id

    const paid = input.paid === undefined || input.paid === '' ? c.total : round2(money(input.paid))
    if (paid > c.total + EPS) throw new AppError('PAID_EXCEEDS_TOTAL')
    if (paid > 0) repo.insertPayment(id, paid, c.date, null)
    return id
  })()
}

/**
 * تعديل فاتورة شراء: بنضيف السطور الجديدة للمخزن وبعدها بنخصم القديمة (ده بيحافظ على متوسط التكلفة صح).
 * لو كمية اتباعت منها بيرفض (OUT_OF_STOCK). مينفعش لو عليها مرتجعات (احذف المرتجع الأول).
 * أسعار البيع والجملة على المنتجات الموجودة مبتتغيرش من التعديل.
 * الدفعات: بتفضل زي ما هي (والإجمالي الجديد مينفعش يقل عنها). لو بقت من جيب الشريك دفعاتها بتتمسح،
 * ولو كانت من جيب الشريك وبقت من فلوس المخزن بتتسجل مدفوعة كلها زي ما كانت.
 */
export function updatePurchase({ id, ...input }: PurchaseInput & { id: number }): void {
  const c = cleanPurchase(input)
  getDb().transaction(() => {
    const before = repo.findById(id)
    if (!before) throw new AppError('PURCHASE_NOT_FOUND')
    assertPurchaseOpen(id)
    assertOpen(c.date)
    if (repo.returnsCount(id) > 0) throw new AppError('HAS_RETURNS')

    const old = repo.findLineRows(id)
    repo.deleteLines(id)
    repo.updateHeader(id, header(c))
    receiveLines(id, c, true, (created) => created)
    releaseLines(old)

    if (c.paidByPartner) return repo.removePayments(id)
    if (before.paid_by_partner === 1) {
      if (c.total > 0) repo.insertPayment(id, c.total, c.date, null)
      return
    }
    if (repo.sumPayments(id) > c.total + EPS) throw new AppError('TOTAL_BELOW_PAID')
  })()
}

/** حذف فاتورة شراء: الكميات بتتخصم من المخزن (لو اتباعت منها بيرفض)، ودفعاتها بتتحذف معاها. مينفعش لو عليها مرتجعات. */
export function removePurchase({ id }: { id: number }): void {
  getDb().transaction(() => {
    if (!repo.findById(id)) throw new AppError('PURCHASE_NOT_FOUND')
    assertPurchaseOpen(id)
    if (repo.returnsCount(id) > 0) throw new AppError('HAS_RETURNS')
    releaseLines(repo.findLineRows(id))
    repo.remove(id)
  })()
}

/** دفعة للمورد على فاتورة: مينفعش أكتر من المتبقي، ولا على فاتورة دفعها الشريك من جيبه */
export function payPurchase(input: PurchasePaymentInput): number {
  const purchase = repo.findById(Number(input.purchase_id))
  if (!purchase) throw new AppError('PURCHASE_NOT_FOUND')
  if (purchase.paid_by_partner === 1) throw new AppError('PAID_BY_PARTNER')
  assertPurchaseOpen(purchase.id, { day: false }) // الدفع في يوم تاني على فاتورة يوم مقفول مسموح
  if (purchase.remaining <= 0) throw new AppError('NOTHING_DUE')
  const amount = positiveAmount(input.amount)
  if (amount > purchase.remaining + EPS) throw new AppError('PAYMENT_EXCEEDS_REMAINING')
  const date = input.payment_date || today()
  assertOpen(date)
  return repo.insertPayment(purchase.id, amount, date, input.notes?.trim() || null)
}

export function removePurchasePayment({ id }: { id: number }): void {
  if (!repo.findPayment(id)) throw new AppError('PAYMENT_NOT_FOUND')
  assertPurchasePaymentOpen(id)
  repo.removePayment(id)
}
