import type { SalePayment, SaleRefund } from '@shared/types'
import { execute, queryAll } from '../../database/connection'

export const insert = (saleId: number, amount: number, date: string, notes: string | null, fromCredit = false) =>
  execute('INSERT INTO sale_payments(sale_id, amount, payment_date, notes, from_credit) VALUES (?, ?, ?, ?, ?)', [saleId, amount, date, notes, fromCredit ? 1 : 0])


export const remove = (id: number) => void execute('DELETE FROM sale_payments WHERE id = ?', [id])
export const removeBySale = (saleId: number) => void execute('DELETE FROM sale_payments WHERE sale_id = ?', [saleId])

/** كل دفعات عميل (من كل فواتيره) من الأحدث للأقدم */
export const findByCustomer = (customerId: number) =>
  queryAll<SalePayment>(
    `SELECT p.id, p.sale_id, p.amount, p.payment_date, p.notes, p.from_credit
     FROM sale_payments p JOIN sales s ON s.id = p.sale_id
     WHERE s.customer_id = ? ORDER BY p.payment_date DESC, p.id DESC`,
    [customerId]
  )

export const findBySale = (saleId: number) =>
  queryAll<SalePayment>(
    'SELECT id, sale_id, amount, payment_date, notes, from_credit FROM sale_payments WHERE sale_id = ? ORDER BY payment_date, id',
    [saleId]
  )

/** رد فلوس من فاتورة: كاش مع مرتجع، أو رصيد اتخصم في فاتورة تانية (paymentId = الدفعة هناك) */
export const insertRefund = (r: { sale_id: number; amount: number; date: string; kind: 'cash' | 'credit'; return_id?: number | null; payment_id?: number | null }) =>
  execute(
    'INSERT INTO sale_refunds(sale_id, amount, refund_date, kind, return_id, payment_id) VALUES (?, ?, ?, ?, ?, ?)',
    [r.sale_id, r.amount, r.date, r.kind, r.return_id ?? null, r.payment_id ?? null]
  )

/** كل الردود على فواتير عميل (من الأحدث) ومعاها الفاتورة اللي الرصيد اتخصم فيها */
export const refundsByCustomer = (customerId: number) =>
  queryAll<SaleRefund>(
    `SELECT r.id, r.sale_id, r.amount, r.refund_date, r.kind, r.return_id, p.sale_id AS used_in_sale_id
     FROM sale_refunds r JOIN sales s ON s.id = r.sale_id LEFT JOIN sale_payments p ON p.id = r.payment_id
     WHERE s.customer_id = ? ORDER BY r.refund_date DESC, r.id DESC`,
    [customerId]
  )

/** الدفعات اللي اتسجلت فعلًا على الفاتورة (من غير خصم الردود) */
export const sumForSale = (saleId: number): number =>
  queryAll<{ s: number }>('SELECT COALESCE(SUM(amount), 0) AS s FROM sale_payments WHERE sale_id = ?', [saleId])[0].s
