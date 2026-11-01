import type { Condition } from '@shared/types'
import { execute, queryOne } from '../../database/connection'

export interface StockRow {
  id: number
  item_id: number
  condition: Condition
  quantity: number
  purchase_price: number
  selling_price: number
  wholesale_price: number
}

export interface PriceUpdate {
  purchase_price?: number | null
  selling_price?: number | null
  wholesale_price?: number | null
}

/** مخزون المنتج لكل حالة (جديد / تالف): الكمية والأسعار (جدول ITEM_STOCK) */
export const ensureStock = (itemId: number, condition: Condition) =>
  void execute('INSERT OR IGNORE INTO item_stock(item_id, condition) VALUES (?, ?)', [itemId, condition])

export const getStock = (itemId: number, condition: Condition) =>
  queryOne<StockRow>('SELECT * FROM item_stock WHERE item_id = ? AND condition = ?', [itemId, condition])

export function changeStock(itemId: number, condition: Condition, delta: number): void {
  ensureStock(itemId, condition)
  execute('UPDATE item_stock SET quantity = quantity + ? WHERE item_id = ? AND condition = ?', [delta, itemId, condition])
}

/** تحديث الأسعار اللي اتبعتت بس (null = سيبه زي ما هو) */
export function setPrices(itemId: number, condition: Condition, prices: PriceUpdate): void {
  ensureStock(itemId, condition)
  execute(
    `UPDATE item_stock
     SET purchase_price = COALESCE(@purchase_price, purchase_price),
         selling_price = COALESCE(@selling_price, selling_price),
         wholesale_price = COALESCE(@wholesale_price, wholesale_price)
     WHERE item_id = @itemId AND condition = @condition`,
    {
      itemId,
      condition,
      purchase_price: prices.purchase_price ?? null,
      selling_price: prices.selling_price ?? null,
      wholesale_price: prices.wholesale_price ?? null
    }
  )
}

/** تحديد الكمية والأسعار مرة واحدة لحالة معينة (بيستخدمه فورم المنتج) */
export function setStock(
  itemId: number,
  condition: Condition,
  s: { quantity: number; purchase_price: number; selling_price: number; wholesale_price: number }
): void {
  ensureStock(itemId, condition)
  execute('UPDATE item_stock SET quantity = ?, purchase_price = ?, selling_price = ?, wholesale_price = ? WHERE item_id = ? AND condition = ?', [
    s.quantity, s.purchase_price, s.selling_price, s.wholesale_price, itemId, condition
  ])
}
