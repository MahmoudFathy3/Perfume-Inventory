import { addToAverage, removeFromAverage } from '../../lib/cost'
import { AppError, round4 } from '../../lib/errors'
import * as items from '../items/items.repository'
import * as itemStock from '../items/stock.repository'
import { resolveItem } from '../items/items.service'
import * as repo from './purchases.repository'
import type { PurchaseLineRow } from './purchases.repository'
import type { CleanPurchase } from './purchases.validation'

/**
 * بيسجّل سطور الشراء ويضيف كمياتها للمخزن. شحن الشراء بيتوزع على القطع حسب قيمة كل سطر ويدخل في التكلفة (landed_cost).
 * applyPrices(created): هل نحدّث سعر بيع/جملة المنتج من الفاتورة؟ (فاتورة جديدة: أيوه، تعديل: للمنتجات الجديدة بس)
 */
export function receiveLines(purchaseId: number, c: CleanPurchase, allowArchived: boolean, applyPrices: (created: boolean) => boolean): void {
  const totalQty = c.lines.reduce((sum, l) => sum + l.quantity, 0)

  for (const l of c.lines) {
    const { id: itemId, created } = resolveItem(l.raw) // لو المنتج جديد بيتعمل هنا (واسمه مينفعش يتكرر)
    const meta = items.getMeta(itemId, allowArchived)
    if (!meta) throw new AppError('ITEM_NOT_FOUND')

    const lineValue = l.quantity * l.purchase_price
    const share = c.subtotal > 0 ? c.shipping * (lineValue / c.subtotal) : c.shipping * (l.quantity / totalQty)
    const landed_cost = round4(l.purchase_price + share / l.quantity)

    repo.insertLine({
      purchase_id: purchaseId,
      item_id: itemId,
      category_id: meta.category_id,
      condition: l.condition,
      quantity: l.quantity,
      purchase_price: l.purchase_price,
      landed_cost,
      selling_price: l.selling_price ?? 0,
      wholesale_price: l.wholesale_price ?? 0
    })

    // التكلفة في المخزن = المتوسط المرجّح (القديم + الجديد شاملة الشحن)
    const stock = itemStock.getStock(itemId, l.condition)
    const average = addToAverage(stock?.quantity ?? 0, stock?.purchase_price ?? 0, l.quantity, landed_cost)
    itemStock.changeStock(itemId, l.condition, l.quantity)
    itemStock.setPrices(itemId, l.condition, {
      purchase_price: average,
      selling_price: applyPrices(created) ? l.selling_price : null,
      wholesale_price: applyPrices(created) ? l.wholesale_price : null
    })
  }
}

/** بيخصم كميات سطور قديمة من المخزن بتكلفتها (للتعديل والحذف). لو الكمية اتباعت بيرفض. */
export function releaseLines(lines: PurchaseLineRow[]): void {
  for (const line of lines) {
    const stock = itemStock.getStock(line.item_id, line.condition)
    if (!stock || stock.quantity < line.quantity) throw new AppError('OUT_OF_STOCK')
    itemStock.setPrices(line.item_id, line.condition, {
      purchase_price: removeFromAverage(stock.quantity, stock.purchase_price, line.quantity, line.landed_cost)
    })
    itemStock.changeStock(line.item_id, line.condition, -line.quantity)
  }
}
