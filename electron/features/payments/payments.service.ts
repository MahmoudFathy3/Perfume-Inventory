import type { CollectInput } from '@shared/types'
import { getDb } from '../../database/connection'
import { AppError, positiveAmount, round2, today } from '../../lib/errors'
import * as salesRepo from '../sales/sales.repository'
import { syncSalePayments } from '../transfers/transfers.sales'
import * as repo from './payments.repository'

/** تسامح صغير في المقارنة علشان كسور الفلوس */
const EPS = 0.005

/**
 * تحصيل مبلغ من عميل:
 * - على فاتورة معينة (sale_id): المبلغ مينفعش يزيد عن المتبقي عليها.
 * - على العميل (customer_id): بيتوزع على أقدم فواتيره الأول (كل فاتورة تتقفل قبل اللي بعدها).
 * بيرجّع ids الدفعات اللي اتسجلت.
 */
export function collect(input: CollectInput): number[] {
  const amount = positiveAmount(input.amount)
  const date = input.payment_date || today()
  const notes = String(input.notes ?? '').trim() || null

  return getDb().transaction((): number[] => {
    if (input.sale_id) {
      const sale = salesRepo.findById(input.sale_id)
      if (!sale) throw new AppError('SALE_NOT_FOUND')
      if (sale.remaining <= 0) throw new AppError('NOTHING_DUE')
      if (amount > sale.remaining + EPS) throw new AppError('PAYMENT_EXCEEDS_REMAINING')
      const id = repo.insert(sale.id, amount, date, notes)
      syncSalePayments(sale.id)
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
      syncSalePayments(sale.id)
      left = round2(left - part)
    }
    return ids
  })()
}

/** حذف دفعة اتسجلت بالغلط (المتبقي على الفاتورة بيرجع يزيد، وتحويلاتها بترجع متدفعتش) */
export const removePayment = ({ id }: { id: number }): void =>
  getDb().transaction(() => {
    const saleId = repo.saleIdOf(id)
    repo.remove(id)
    if (saleId) syncSalePayments(saleId)
  })()
