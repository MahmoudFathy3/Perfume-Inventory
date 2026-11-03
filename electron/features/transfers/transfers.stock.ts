import type { Condition } from '@shared/types'
import { addToAverage, removeFromAverage } from '../../lib/cost'
import { AppError } from '../../lib/errors'
import { normalizeArabic } from '../../lib/normalizeArabic'
import { PERSONAL_WORKSPACE_ID, withWorkspace } from '../../lib/workspace'
import * as categories from '../categories/categories.repository'
import * as items from '../items/items.repository'
import * as itemStock from '../items/stock.repository'
import type { TransferLineRow } from './transfers.repository'
import type { CleanTransfer } from './transfers.validation'

/** سطر خرج من المصدر: بيانات المنتج وقت التحويل وتكلفته وسعره */
export interface OutgoingLine {
  from_item_id: number
  condition: Condition
  quantity: number
  unit_cost: number
  /** تكلفة القطعة في الوجهة (= unit_cost إلا في البيع بسعر محدد) */
  unit_price: number
  name_ar: string
  name_en: string | null
  category_name: string
  selling_price: number
  wholesale_price: number
}

/**
 * سعر القطعة لو مش مكتوب: البيع من المخزون الفعلي للشراكة بسعر البيع القطاعي (ولو مش متحدد بالتكلفة)،
 * وأي تحويل تاني بتكلفة المصدر.
 */
function defaultPrice(c: CleanTransfer, stock: { purchase_price: number; selling_price: number }): number {
  const retail = c.kind === 'sale' && c.from === PERSONAL_WORKSPACE_ID && stock.selling_price > 0
  return retail ? stock.selling_price : stock.purchase_price
}

/** بيخصم القطع من المخزن المصدر بتكلفتها (متوسط تكلفة المصدر) ويرجّع بياناتها للوجهة */
export function takeOut(c: CleanTransfer): OutgoingLine[] {
  return withWorkspace(c.from, () =>
    c.lines.map((l) => {
      const item = items.findById(l.item_id)
      if (!item || item.deleted_at) throw new AppError('ITEM_NOT_FOUND')
      const stock = itemStock.getStock(l.item_id, l.condition)
      if (!stock || stock.quantity < l.quantity) throw new AppError('OUT_OF_STOCK')
      itemStock.changeStock(l.item_id, l.condition, -l.quantity)
      return {
        from_item_id: l.item_id,
        condition: l.condition,
        quantity: l.quantity,
        unit_cost: stock.purchase_price,
        unit_price: l.unit_price ?? defaultPrice(c, stock),
        name_ar: item.name_ar,
        name_en: item.name_en,
        category_name: item.category_name,
        selling_price: stock.selling_price,
        wholesale_price: stock.wholesale_price
      }
    })
  )
}

/** المنتج في الوجهة بالاسم (من غير تفرقة همزة/تاء مربوطة). مش موجود = بيتعمل هو وصنفه. */
function findOrCreateItem(line: OutgoingLine): { id: number; created: boolean } {
  const existing = items.findDuplicate([line.name_ar, line.name_en ?? ''].filter(Boolean))
  if (existing) return { id: existing.id, created: false }
  const category_id = categories.findByName(line.category_name)?.id ?? categories.insert(line.category_name)
  const id = items.insert({
    category_id,
    name_ar: line.name_ar,
    name_en: line.name_en,
    search_text: normalizeArabic(`${line.name_ar} ${line.name_en ?? ''}`)
  })
  return { id, created: true }
}

/** بيدخّل القطع في مخزن الوجهة بمتوسط تكلفة مرجّح، وبيرجّع رقم المنتج في الوجهة لكل سطر */
export function putIn(destination: number, lines: OutgoingLine[]): number[] {
  return withWorkspace(destination, () =>
    lines.map((l) => {
      const { id, created } = findOrCreateItem(l)
      const stock = itemStock.getStock(id, l.condition)
      const average = addToAverage(stock?.quantity ?? 0, stock?.purchase_price ?? 0, l.quantity, l.unit_price)
      itemStock.changeStock(id, l.condition, l.quantity)
      // أسعار البيع بتتنقل مع المنتج الجديد بس، والموجود بيحتفظ بأسعاره
      itemStock.setPrices(id, l.condition, {
        purchase_price: average,
        selling_price: created ? l.selling_price : null,
        wholesale_price: created ? l.wholesale_price : null
      })
      return id
    })
  )
}

/** عكس التحويل: القطع ترجع للمصدر بتكلفتها الأصلية وتخرج من الوجهة. لو الوجهة بتصرفتها بيرفض. */
export function reverse(fromWorkspace: number, toWorkspace: number, lines: TransferLineRow[]): void {
  withWorkspace(toWorkspace, () => {
    for (const l of lines) {
      const stock = itemStock.getStock(l.to_item_id, l.condition)
      if (!stock || stock.quantity < l.quantity) throw new AppError('OUT_OF_STOCK')
      itemStock.setPrices(l.to_item_id, l.condition, {
        purchase_price: removeFromAverage(stock.quantity, stock.purchase_price, l.quantity, l.unit_price)
      })
      itemStock.changeStock(l.to_item_id, l.condition, -l.quantity)
    }
  })
  withWorkspace(fromWorkspace, () => {
    for (const l of lines) {
      itemStock.ensureStock(l.from_item_id, l.condition)
      const stock = itemStock.getStock(l.from_item_id, l.condition)!
      itemStock.setPrices(l.from_item_id, l.condition, {
        purchase_price: addToAverage(stock.quantity, stock.purchase_price, l.quantity, l.unit_cost)
      })
      itemStock.changeStock(l.from_item_id, l.condition, l.quantity)
    }
  })
}
