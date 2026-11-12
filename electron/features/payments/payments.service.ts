import type { CollectInput } from '@shared/types'
import { getDb } from '../../database/connection'
import { AppError, positiveAmount, round2, today } from '../../lib/errors'
import { assertOpen, assertSaleOpen, assertSalePaymentOpen } from '../../lib/monthLock'
import * as salesRepo from '../sales/sales.repository'
import * as repo from './payments.repository'

/** تسامح صغير في المقارنة علشان كسور الفلوس */
const EPS = 0.005

/**
 * تحصيل مبلغ من عميل:
 * - على فاتورة معينة (sale_id): المبلغ مينفعش يزيد عن المتبقي عليها.
 * - على العميل (customer_id): بيتوزع على أقدم فواتيره الأول (كل فاتورة تتقفل قبل اللي بعدها).
 * from_credit (على العميل بس): بيتخصم من رصيده (اللي دفعه زيادة في فواتير قديمة) بدل فلوس جديدة.
 * بيرجّع ids الدفعات اللي اتسجلت.
 */
export function collect(input: CollectInput): number[] {
  if (input.from_credit) {
    if (!input.customer_id) throw new AppError('CUSTOMER_REQUIRED')
    return getDb().transaction(() => useCredit(input.customer_id!, positiveAmount(input.amount), input.payment_date || today()))()
  }
  const amount = positiveAmount(input.amount)
  const date = input.payment_date || today()
  const notes = String(input.notes ?? '').trim() || null
  assertOpen(date)

  return getDb().transaction((): number[] => {
    if (input.sale_id) {
      const sale = salesRepo.findById(input.sale_id)
      if (!sale) throw new AppError('SALE_NOT_FOUND')
      assertSaleOpen(sale.id, { day: false }) // التحصيل في يوم تاني على فاتورة يوم مقفول مسموح
      if (sale.remaining <= 0) throw new AppError('NOTHING_DUE')
      if (amount > sale.remaining + EPS) throw new AppError('PAYMENT_EXCEEDS_REMAINING')
      const id = repo.insert(sale.id, amount, date, notes)
      return [id]
    }

    if (!input.customer_id) throw new AppError('CUSTOMER_REQUIRED')
    const unpaid = salesRepo
      .findAll({ customerId: input.customer_id })
      .filter((s) => s.remaining > 0)
      .sort((a, b) => a.sale_date.localeCompare(b.sale_date) || a.id - b.id) // الأقدم أولًا
    const due = round2(unpaid.reduce((sum, s) => sum + s.remaining, 0))
    if (due <= 0) throw new AppError('NOTHING_DUE')
    if (amount > due + EPS) throw new AppError('PAYMENT_EXCEEDS_REMAINING')

    const ids: number[] = []
    let left = amount
    for (const sale of unpaid) {
      if (left <= 0) break
      const part = round2(Math.min(left, sale.remaining))
      ids.push(repo.insert(sale.id, part, date, notes))
      left = round2(left - part)
    }
    return ids
  })()
}

/**
 * خصم رصيد العميل على فواتيره اللي عليها فلوس (الأقدم أولًا من الناحيتين):
 * على الفاتورة اللي ليه فيها رصيد بيتسجل "رد" (credit)، وعلى الفاتورة اللي عليها دفعة من الرصيد.
 * onlySale = الخصم على فاتورة واحدة بس (فاتورة جديدة). بيرجّع ids الدفعات.
 */
export function useCredit(customerId: number, amount: number, date: string, onlySale?: number): number[] {
  const all = salesRepo.findAll({ customerId }).sort((a, b) => a.sale_date.localeCompare(b.sale_date) || a.id - b.id)
  const credits = all.filter((s) => s.credit > EPS).map((s) => ({ id: s.id, left: s.credit }))
  const debts = all.filter((s) => s.remaining > EPS && (onlySale === undefined || s.id === onlySale)).map((s) => ({ id: s.id, left: s.remaining }))
  const available = round2(credits.reduce((sum, c) => sum + c.left, 0))
  const due = round2(debts.reduce((sum, d) => sum + d.left, 0))
  if (available <= EPS) throw new AppError('NO_CREDIT')
  if (due <= EPS) throw new AppError('NOTHING_DUE')
  if (amount > Math.min(available, due) + EPS) throw new AppError('PAYMENT_EXCEEDS_REMAINING')
  assertOpen(date)

  const ids: number[] = []
  let left = amount
  for (const debt of debts) {
    for (const credit of credits) {
      const part = round2(Math.min(left, debt.left, credit.left))
      if (part <= 0) continue
      // الرصيد ممكن يكون من فاتورة في شهر مقفول (عادي: الزيادة مش داخلة في أرقام الشهر)، بس الفاتورة اللي بتتدفع لازم تكون مفتوحة
      assertSaleOpen(debt.id, { day: false })
      const paymentId = repo.insert(debt.id, part, date, null, true)
      repo.insertRefund({ sale_id: credit.id, amount: part, date, kind: 'credit', payment_id: paymentId })
      ids.push(paymentId)
      debt.left = round2(debt.left - part)
      credit.left = round2(credit.left - part)
      left = round2(left - part)
    }
  }
  return ids
}

/** حذف دفعة اتسجلت بالغلط (المتبقي على الفاتورة بيرجع يزيد) */
export function removePayment({ id }: { id: number }): void {
  assertSalePaymentOpen(id)
  repo.remove(id)
}
