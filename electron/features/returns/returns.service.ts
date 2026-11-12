import type { DateFilter, PageParams, ReturnInput } from '@shared/types'
import { getDb } from '../../database/connection'
import { addToAverage, removeFromAverage } from '../../lib/cost'
import { AppError, money, parseCondition, qty, round2, today } from '../../lib/errors'
import { assertOpen, assertReturnOpen } from '../../lib/monthLock'
import * as itemStock from '../items/stock.repository'
import * as paymentsRepo from '../payments/payments.repository'
import { findById as findSale, isPartnerTransferSale } from '../sales/sales.repository'
import { returnableToSource, returnToSaleSource, undoReturnToSaleSource } from '../transfers/transfers.sales'
import * as repo from './returns.repository'

export const listReturns = (p: { search?: string } & DateFilter) => repo.findAll(p)
export const pageReturns = (p: { search?: string } & DateFilter & PageParams) => repo.findPage(p, p)
export const getReturn = ({ id }: { id: number }) => repo.findById(id)

/** مرتجع بيع: القطع بترجع للمخزن | مرتجع شراء: القطع بتخرج من المخزن */
export function createReturn(input: ReturnInput): number {
  const type = input.type
  if (type !== 'sale' && type !== 'purchase') throw new AppError('INVALID_TYPE')
  const invoiceId = type === 'sale' ? input.sale_id : input.purchase_id
  if (!invoiceId) throw new AppError('INVOICE_REQUIRED')
  if (!Array.isArray(input.items) || input.items.length === 0) throw new AppError('NO_LINES')
  // فاتورة الشريك (من تحويل): القطع في الشراكة مش هنا، فالرجوع بيكون بتعديل التحويل
  if (type === 'sale' && isPartnerTransferSale(invoiceId)) throw new AppError('SALE_FROM_TRANSFER')
  // المرتجع بيتسجل بتاريخه (ممكن يكون على فاتورة من شهر مقفول، والأثر بيبقى في شهر المرتجع)
  assertOpen(input.return_date)

  return getDb().transaction(() => {
    const returnId = repo.insertHeader({
      type,
      sale_id: type === 'sale' ? invoiceId : null,
      purchase_id: type === 'purchase' ? invoiceId : null,
      return_date: input.return_date || today(),
      reason: input.reason || null,
      total: 0
    })

    let total = 0
    for (const l of input.items) {
      const condition = parseCondition(l.condition)
      const quantity = qty(l.quantity)
      const unit_price = money(l.unit_price)

      const available = repo.originalQuantity(type, invoiceId, l.item_id) - repo.returnedQuantity(type, invoiceId, l.item_id)
      if (quantity > available) throw new AppError('RETURN_EXCEEDS')

      // قطع جاية من مخزن تاني بترجع له مباشرة (والتحويل بيقل)، من غير ما تدخل مخزن الفاتورة
      const toSource = type === 'sale' && !!l.to_source
      if (toSource) {
        if (quantity > returnableToSource(invoiceId, l.item_id, condition)) throw new AppError('RETURN_EXCEEDS_SOURCE')
        returnToSaleSource(invoiceId, l.item_id, condition, quantity)
        repo.insertLine({ return_id: returnId, item_id: l.item_id, quantity, unit_price, condition, to_source: 1 })
        total += quantity * unit_price
        continue
      }

      itemStock.ensureStock(l.item_id, condition)
      const stock = itemStock.getStock(l.item_id, condition)!
      if (type === 'sale') {
        // القطع بترجع بتكلفتها وقت البيع وبتدخل في المتوسط
        const cost = repo.saleLineCost(invoiceId, l.item_id, condition)
        itemStock.setPrices(l.item_id, condition, { purchase_price: addToAverage(stock.quantity, stock.purchase_price, quantity, cost) })
        itemStock.changeStock(l.item_id, condition, quantity)
      } else {
        // القطع بتخرج بتكلفة فاتورتها، والمتوسط بيتحسب من اللي فضل
        if (stock.quantity < quantity) throw new AppError('OUT_OF_STOCK')
        const cost = repo.purchaseLineCost(invoiceId, l.item_id, condition)
        itemStock.setPrices(l.item_id, condition, { purchase_price: removeFromAverage(stock.quantity, stock.purchase_price, quantity, cost) })
        itemStock.changeStock(l.item_id, condition, -quantity)
      }

      repo.insertLine({ return_id: returnId, item_id: l.item_id, quantity, unit_price, condition })
      total += quantity * unit_price
    }

    repo.setTotal(returnId, round2(total))
    if (type === 'sale') {
      refundCash(invoiceId, returnId, input.refund, input.return_date || today())
    }
    return returnId
  })()
}

/**
 * فلوس العميل بعد المرتجع: لو دفع أكتر من صافي الفاتورة، اللي اترد له كاش بيتسجل، والباقي بيفضل رصيد له.
 * فاتورة من غير عميل (كاش): مفيش حد نشيل له رصيد، فالزيادة كلها بترجع كاش.
 */
function refundCash(saleId: number, returnId: number, requested: unknown, date: string): void {
  const sale = findSale(saleId)
  if (!sale || sale.credit <= 0.005) {
    if (requested !== undefined && requested !== '' && money(requested) > 0) throw new AppError('REFUND_EXCEEDS')
    return
  }
  const amount = sale.customer_id === null ? sale.credit : requested === undefined || requested === '' ? 0 : round2(money(requested))
  if (amount > sale.credit + 0.005) throw new AppError('REFUND_EXCEEDS')
  if (amount > 0) paymentsRepo.insertRefund({ sale_id: saleId, amount, date, kind: 'cash', return_id: returnId })
}

/**
 * حذف مرتجع (لو اتسجل بالغلط): بنعكس تأثيره على المخزن.
 * مرتجع البيع كان رجّع قطع للمخزن فبنشيلها (لو اتباعت بيرفض)، ومرتجع الشراء كان شال قطع فبنرجّعها.
 */
export function removeReturn({ id }: { id: number }): void {
  getDb().transaction(() => {
    const record = repo.findById(id)
    if (!record) throw new AppError('RETURN_NOT_FOUND')
    assertReturnOpen(id)
    const invoiceId = (record.type === 'sale' ? record.sale_id : record.purchase_id)!

    for (const l of repo.findLineRows(id)) {
      if (record.type === 'sale' && l.to_source) {
        undoReturnToSaleSource(invoiceId, l.item_id, l.condition, l.quantity)
        continue
      }
      itemStock.ensureStock(l.item_id, l.condition)
      const stock = itemStock.getStock(l.item_id, l.condition)!
      if (record.type === 'sale') {
        if (stock.quantity < l.quantity) throw new AppError('OUT_OF_STOCK')
        const cost = repo.saleLineCost(invoiceId, l.item_id, l.condition)
        itemStock.setPrices(l.item_id, l.condition, { purchase_price: removeFromAverage(stock.quantity, stock.purchase_price, l.quantity, cost) })
        itemStock.changeStock(l.item_id, l.condition, -l.quantity)
      } else {
        const cost = repo.purchaseLineCost(invoiceId, l.item_id, l.condition)
        itemStock.setPrices(l.item_id, l.condition, { purchase_price: addToAverage(stock.quantity, stock.purchase_price, l.quantity, cost) })
        itemStock.changeStock(l.item_id, l.condition, l.quantity)
      }
    }
    repo.remove(id)
  })()
}
