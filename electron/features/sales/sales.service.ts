import type { DateFilter, PageParams, SaleInput } from '@shared/types'
import { getDb } from '../../database/connection'
import { AppError, money, round2 } from '../../lib/errors'
import { assertOpen, assertSaleOpen } from '../../lib/monthLock'
import { activeWorkspaceId } from '../../lib/workspace'
import { removeSaleTransfers, restoreSaleTransferPayments, saveSaleTransferPayments, sourcePrice, transferForSale } from '../transfers/transfers.sales'
import * as payments from '../payments/payments.repository'
import { useCredit } from '../payments/payments.service'
import * as repo from './sales.repository'
import { restoreLines, sellLines } from './sales.stock'
import { cleanSale } from './sales.validation'
import type { CleanSale } from './sales.validation'

const EPS = 0.005
type SalesFilter = { search?: string; partnerId?: number } & DateFilter
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

/**
 * السطور الجاية من مخزن تاني بتتحوّل لمخزن الفاتورة الأول (بيع بسعر، مربوط بالفاتورة)،
 * وبعدها بتتباع زي أي سطر بتكلفة = سعر التحويل. سعر التحويل الافتراضي = سعر البيع في السطر.
 */
function bringForeignLines(saleId: number, c: CleanSale): CleanSale {
  const foreign = c.lines.map((l, i) => ({ l, i })).filter(({ l }) => l.source !== null)
  if (foreign.length === 0) return c
  const prices = foreign.map(({ l }) => l.transfer_price ?? l.selling_price ?? sourcePrice(l.source!, l.item_id, l.condition, c.priceType))
  const ids = transferForSale(
    saleId,
    activeWorkspaceId(),
    c.date,
    foreign.map(({ l }, k) => ({ source: l.source!, item_id: l.item_id, condition: l.condition, quantity: l.quantity, unit_price: prices[k] }))
  )
  const lines = [...c.lines]
  foreign.forEach(({ l, i }, k) => {
    lines[i] = { ...l, item_id: ids[k], source_item_id: l.item_id, cost: prices[k], selling_price: l.selling_price ?? prices[k] }
  })
  return { ...c, lines }
}

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
  assertOpen(c.date)
  return getDb().transaction(() => {
    const id = repo.insertHeader(header(c, 0))
    const total = invoiceTotal(c, sellLines(id, bringForeignLines(id, c), false))
    repo.setTotal(id, total)

    // رصيد العميل (لو ليه) بيتخصم الأول، والمدفوع كاش الافتراضي = اللي فاضل
    let fromCredit = 0
    if (input.use_credit && c.customerId && total > 0) {
      const available = repo.findAll({ customerId: c.customerId }).reduce((sum, s) => sum + (s.id === id ? 0 : s.credit), 0)
      if (available > EPS) {
        fromCredit = round2(Math.min(available, total))
        useCredit(c.customerId, fromCredit, c.date, id)
      }
    }
    const due = round2(total - fromCredit)
    const paid = input.paid === undefined || input.paid === '' ? due : round2(money(input.paid))
    if (paid > due + EPS) throw new AppError('PAID_EXCEEDS_TOTAL')
    assertCustomerForDebt(c, due, paid)
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
    assertSaleOpen(id)
    assertOpen(c.date)
    if (repo.isPartnerTransferSale(id)) throw new AppError('SALE_FROM_TRANSFER')
    if (repo.returnsCount(id) > 0) throw new AppError('HAS_RETURNS')

    restoreLines(id)
    // القطع اللي كانت جاية من مخزن تاني بترجع له، وبتتحوّل تاني بالسطور الجديدة (ودفعات التحويلات بترجع عليها)
    const transferPayments = saveSaleTransferPayments(id)
    removeSaleTransfers(id)
    repo.deleteLines(id)
    repo.updateHeader(id, header(c, 0))
    const total = invoiceTotal(c, sellLines(id, bringForeignLines(id, c), true))
    repo.setTotal(id, total)
    restoreSaleTransferPayments(id, transferPayments)

    if (!c.customerId && old.customer_id === null) {
      payments.removeBySale(id)
      if (total > 0) payments.insert(id, total, c.date, null)
    } else {
      const paid = payments.sumForSale(id)
      if (paid > total + EPS) throw new AppError('TOTAL_BELOW_PAID')
      assertCustomerForDebt(c, total, paid)
    }
  })()
}

/** حذف فاتورة بيع: الكميات بترجع للمخزن، والدفعات بتتحذف معاها. مينفعش لو عليها مرتجعات. */
export function removeSale({ id }: { id: number }): void {
  getDb().transaction(() => {
    if (!repo.findById(id)) throw new AppError('SALE_NOT_FOUND')
    assertSaleOpen(id)
    if (repo.isPartnerTransferSale(id)) throw new AppError('SALE_FROM_TRANSFER')
    if (repo.returnsCount(id) > 0) throw new AppError('HAS_RETURNS')
    restoreLines(id)
    removeSaleTransfers(id)
    repo.remove(id)
  })()
}
