import { addToAverage, removeFromAverage } from '../../lib/cost'
import { AppError } from '../../lib/errors'
import * as items from '../items/items.repository'
import * as itemStock from '../items/stock.repository'
import * as repo from './sales.repository'
import type { CleanSale } from './sales.validation'

/** بيبيع السطور من المخزن ويسجلها على الفاتورة، وبيرجّع إجمالي الأصناف */
export function sellLines(saleId: number, c: CleanSale, allowArchived: boolean): number {
  let subtotal = 0
  for (const l of c.lines) {
    const meta = items.getMeta(l.item_id, allowArchived)
    if (!meta) throw new AppError('ITEM_NOT_FOUND')

    const stock = itemStock.getStock(l.item_id, l.condition)
    if (!stock || stock.quantity < l.quantity) throw new AppError('OUT_OF_STOCK')

    // السعر الافتراضي حسب نوع الفاتورة (جملة أو قطاعي)، ولو سعر الجملة مش متحدد بنستخدم القطاعي
    const defaultPrice = c.priceType === 'wholesale' && stock.wholesale_price > 0 ? stock.wholesale_price : stock.selling_price
    const selling_price = l.selling_price ?? defaultPrice

    // السطر الجاي من مخزن تاني: تكلفته = سعر التحويل بالظبط (مش متوسط المخزن)، والمتوسط بيتظبط على كده
    const cost = l.cost ?? stock.purchase_price
    if (l.cost !== undefined) {
      itemStock.setPrices(l.item_id, l.condition, { purchase_price: removeFromAverage(stock.quantity, stock.purchase_price, l.quantity, l.cost) })
    }

    repo.insertLine({
      sale_id: saleId,
      item_id: l.item_id,
      category_id: meta.category_id,
      condition: l.condition,
      quantity: l.quantity,
      purchase_price: cost, // التكلفة وقت البيع (شاملة الشحن)
      selling_price,
      source_workspace_id: l.source,
      source_item_id: l.source_item_id ?? null,
      transfer_price: l.cost ?? null
    })
    itemStock.changeStock(l.item_id, l.condition, -l.quantity)
    subtotal += l.quantity * selling_price
  }
  return subtotal
}

/** بيرجّع كميات الفاتورة القديمة للمخزن بتكلفتها وقت البيع (للتعديل والحذف) */
export function restoreLines(saleId: number): void {
  for (const line of repo.findLineRows(saleId)) {
    itemStock.ensureStock(line.item_id, line.condition)
    const stock = itemStock.getStock(line.item_id, line.condition)!
    itemStock.setPrices(line.item_id, line.condition, {
      purchase_price: addToAverage(stock.quantity, stock.purchase_price, line.quantity, line.purchase_price)
    })
    itemStock.changeStock(line.item_id, line.condition, line.quantity)
  }
}
