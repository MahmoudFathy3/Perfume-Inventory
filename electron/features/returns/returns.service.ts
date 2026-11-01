import type { PageParams, ReturnInput } from '@shared/types'
import { getDb } from '../../database/connection'
import { addToAverage, removeFromAverage } from '../../lib/cost'
import { AppError, money, parseCondition, qty, round2, today } from '../../lib/errors'
import * as itemStock from '../items/stock.repository'
import * as repo from './returns.repository'

export const listReturns = (p: { search?: string }) => repo.findAll(p)
export const pageReturns = (p: { search?: string } & PageParams) => repo.findPage(p, p)
export const getReturn = ({ id }: { id: number }) => repo.findById(id)

/** مرتجع بيع: القطع بترجع للمخزن | مرتجع شراء: القطع بتخرج من المخزن */
export function createReturn(input: ReturnInput): number {
  const type = input.type
  if (type !== 'sale' && type !== 'purchase') throw new AppError('INVALID_TYPE')
  const invoiceId = type === 'sale' ? input.sale_id : input.purchase_id
  if (!invoiceId) throw new AppError('INVOICE_REQUIRED')
  if (!Array.isArray(input.items) || input.items.length === 0) throw new AppError('NO_LINES')

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
    return returnId
  })()
}

/**
 * حذف مرتجع (لو اتسجل بالغلط): بنعكس تأثيره على المخزن.
 * مرتجع البيع كان رجّع قطع للمخزن فبنشيلها (لو اتباعت بيرفض)، ومرتجع الشراء كان شال قطع فبنرجّعها.
 */
export function removeReturn({ id }: { id: number }): void {
  getDb().transaction(() => {
    const record = repo.findById(id)
    if (!record) throw new AppError('RETURN_NOT_FOUND')
    const invoiceId = (record.type === 'sale' ? record.sale_id : record.purchase_id)!

    for (const l of repo.findLineRows(id)) {
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
