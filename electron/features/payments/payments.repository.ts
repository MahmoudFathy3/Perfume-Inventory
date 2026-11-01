import type { SalePayment } from '@shared/types'
import { execute, queryAll } from '../../database/connection'

export const insert = (saleId: number, amount: number, date: string, notes: string | null) =>
  execute('INSERT INTO sale_payments(sale_id, amount, payment_date, notes) VALUES (?, ?, ?, ?)', [saleId, amount, date, notes])

export const remove = (id: number) => void execute('DELETE FROM sale_payments WHERE id = ?', [id])
export const removeBySale = (saleId: number) => void execute('DELETE FROM sale_payments WHERE sale_id = ?', [saleId])

/** كل دفعات عميل (من كل فواتيره) من الأحدث للأقدم */
export const findByCustomer = (customerId: number) =>
  queryAll<SalePayment>(
    `SELECT p.id, p.sale_id, p.amount, p.payment_date, p.notes
     FROM sale_payments p JOIN sales s ON s.id = p.sale_id
     WHERE s.customer_id = ? ORDER BY p.payment_date DESC, p.id DESC`,
    [customerId]
  )

export const findBySale = (saleId: number) =>
  queryAll<SalePayment>(
    'SELECT id, sale_id, amount, payment_date, notes FROM sale_payments WHERE sale_id = ? ORDER BY payment_date, id',
    [saleId]
  )

export const sumForSale = (saleId: number): number =>
  queryAll<{ s: number }>('SELECT COALESCE(SUM(amount), 0) AS s FROM sale_payments WHERE sale_id = ?', [saleId])[0].s
