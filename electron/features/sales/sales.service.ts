import type { PageParams, SaleInput } from '@shared/types'
import { getDb } from '../../database/connection'
import { AppError, money, round2 } from '../../lib/errors'
import * as payments from '../payments/payments.repository'
import * as repo from './sales.repository'
import { restoreLines, sellLines } from './sales.stock'
import { cleanSale } from './sales.validation'
import type { CleanSale } from './sales.validation'

const EPS = 0.005
type SalesFilter = { search?: string; partnerId?: number }
export const listSales = (p: SalesFilter) => repo.findAll(p)
export const pageSales = (p: SalesFilter & PageParams) => repo.findPage(p, p)
export const getSale = ({ id }: { id: number }) => repo.findById(id)
/** الشحن على العميل بيتضاف للفاتورة، وعلى المحل مصروف بيتخصم من الربح (مش بيدخل في الفاتورة) */
const invoiceTotal = (c: CleanSale, subtotal: number) => round2(subtotal + (c.payer === 'customer' ? c.shipping : 0))

const header = (c: CleanSale, total: number) => ({
  customer_id: c.customerId,
  partner_id: c.partnerId,
  sale_date: c.date,
  price_type: c.priceType,
  shipping_payer: c.payer,
  shipping_cost: c.shipping,
  total,
  notes: c.notes
})

/** لو فيه متبقي لازم يبقى فيه عميل نكتب عليه الدين */
function assertCustomerForDebt(c: CleanSale, total: number, paid: number): void {
  if (total - paid > EPS && !c.customerId) throw new AppError('CUSTOMER_REQUIRED')
}

/**
 * فاتورة بيع جديدة. paid = المدفوع وقت البيع (الافتراضي الفاتورة كلها)،
 * والمتبقي بيتحصّل بعد كده من صفحة العملاء.
 */
export function createSale(input: SaleInput): number {
  const c = cleanSale(input)
  return getDb().transaction(() => {
    const id = repo.insertHeader(header(c, 0))
    const total = invoiceTotal(c, sellLines(id, c, false))
    repo.setTotal(id, total)

    const paid = input.paid === undefined || input.paid === '' ? total : round2(money(input.paid))
    if (paid > total + EPS) throw new AppError('PAID_EXCEEDS_TOTAL')
    assertCustomerForDebt(c, total, paid)
    if (paid > 0) payments.insert(id, paid, c.date, null)
    return id
  })()
}

/**
 * تعديل فاتورة بيع: بنرجّع كمياتها القديمة للمخزن وبنبيع السطور الجديدة من جديد.
 * مينفعش لو عليها مرتجعات (احذف المرتجع الأول).
 * - فاتورة العميل: الدفعات المسجلة بتفضل زي ما هي (والإجمالي الجديد مينفعش يقل عنها).
 * - فاتورة كاش (من غير عميل): بتفضل مدفوعة بالكامل، ودفعتها بتتظبط على الإجمالي الجديد.
 */
export function updateSale({ id, ...input }: SaleInput & { id: number }): void {
  const c = cleanSale(input)
  getDb().transaction(() => {
    const old = repo.findById(id)
    if (!old) throw new AppError('SALE_NOT_FOUND')
    if (repo.returnsCount(id) > 0) throw new AppError('HAS_RETURNS')

    restoreLines(id)
    repo.deleteLines(id)
    repo.updateHeader(id, header(c, 0))
    const total = invoiceTotal(c, sellLines(id, c, true))
    repo.setTotal(id, total)

    if (!c.customerId && old.customer_id === null) {
      payments.removeBySale(id)
      if (total > 0) payments.insert(id, total, c.date, null)
      return
    }
    const paid = payments.sumForSale(id)
    if (paid > total + EPS) throw new AppError('TOTAL_BELOW_PAID')
    assertCustomerForDebt(c, total, paid)
  })()
}

/** حذف فاتورة بيع: الكميات بترجع للمخزن، والدفعات بتتحذف معاها. مينفعش لو عليها مرتجعات. */
export function removeSale({ id }: { id: number }): void {
  getDb().transaction(() => {
    if (!repo.findById(id)) throw new AppError('SALE_NOT_FOUND')
    if (repo.returnsCount(id) > 0) throw new AppError('HAS_RETURNS')
    restoreLines(id)
    repo.remove(id)
  })()
}
