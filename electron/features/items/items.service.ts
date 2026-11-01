import type { Condition, ItemDetails, ItemInput, NumLike, PageParams, RemoveItemResult, StockInput } from '@shared/types'
import { getDb } from '../../database/connection'
import { CONDITIONS } from '../../lib/constants'
import { AppError, money, optionalMoney, parseCondition, round2 } from '../../lib/errors'
import { normalizeArabic } from '../../lib/normalizeArabic'
import { findMovements } from './movements.repository'
import * as repo from './items.repository'
import * as stockRepo from './stock.repository'

type CleanStock = Record<Condition, { quantity: number; purchase_price: number; selling_price: number; wholesale_price: number }>

/** بيانات المنتج: الاسم مطلوب ومينفعش يتكرر (عربي أو إنجليزي)، والصنف بيتحدد بالـ id */
function clean(input: Pick<ItemInput, 'category_id' | 'name_ar' | 'name_en'>, excludeId = 0): repo.ItemRowInput {
  const name_ar = String(input.name_ar ?? '').trim()
  const name_en = String(input.name_en ?? '').trim() || null
  if (!name_ar) throw new AppError('NAME_REQUIRED')
  if (!input.category_id) throw new AppError('CATEGORY_REQUIRED')
  if (repo.findDuplicate([name_ar, name_en ?? ''].filter(Boolean), excludeId)) throw new AppError('DUPLICATE_NAME')
  return { category_id: input.category_id, name_ar, name_en, search_text: normalizeArabic(`${name_ar} ${name_en ?? ''}`) }
}

/** المخزون والأسعار بتيجي مع المنتج في نفس الفورم: stock = { new: {...}, damaged: {...} } */
function cleanStock(stock: Partial<Record<Condition, Partial<StockInput>>> = {}): CleanStock {
  const out = {} as CleanStock
  for (const cond of CONDITIONS) {
    const s = stock[cond] ?? {}
    const raw: NumLike = s.quantity === undefined || s.quantity === '' ? 0 : s.quantity
    const quantity = Number(raw)
    if (!Number.isInteger(quantity) || quantity < 0) throw new AppError('INVALID_QUANTITY')
    out[cond] = {
      quantity,
      purchase_price: money(s.purchase_price),
      selling_price: money(s.selling_price),
      wholesale_price: money(s.wholesale_price)
    }
  }
  return out
}

function applyStock(itemId: number, stock: CleanStock): void {
  for (const cond of CONDITIONS) stockRepo.setStock(itemId, cond, stock[cond])
}

export const listItems = (p: { search?: string; category_id?: number }) => repo.findAll(p)
export const pageItems = (p: { search?: string; category_id?: number } & PageParams) => repo.findPage(p, p)
export const getItem = ({ id }: { id: number }) => repo.findById(id)

export const createItem = (input: ItemInput): number =>
  getDb().transaction(() => {
    const data = clean(input)
    const stock = cleanStock(input.stock)
    const id = repo.insert(data)
    applyStock(id, stock)
    return id
  })()

export const updateItem = ({ id, ...input }: ItemInput & { id: number }): void =>
  getDb().transaction(() => {
    repo.update(id, clean(input, id))
    if (input.stock) applyStock(id, cleanStock(input.stock))
  })()

/**
 * حذف المنتج:
 * - ملوش حركات: بيتحذف نهائيًا.
 * - له حركات (فواتير / مرتجعات): بيتأرشف (بيتخفي) والفواتير القديمة بتفضل كاملة.
 */
export function removeItem({ id }: { id: number }): RemoveItemResult {
  return getDb().transaction((): RemoveItemResult => {
    if (repo.hasHistory(id)) {
      repo.archive(id)
      return { mode: 'archived' }
    }
    repo.remove(id)
    return { mode: 'deleted' }
  })()
}

/** تعديل سعر الشراء / البيع / الجملة يدويًا لحالة معينة (جديد أو تالف) */
export function updatePrices(p: { id: number; condition: Condition } & Partial<StockInput>): void {
  stockRepo.setPrices(p.id, parseCondition(p.condition), {
    purchase_price: optionalMoney(p.purchase_price),
    selling_price: optionalMoney(p.selling_price),
    wholesale_price: optionalMoney(p.wholesale_price)
  })
}

/**
 * بيرجّع id المنتج: موجود بالـ id، أو منتج جديد بيتعمل في نفس اللحظة (اسمه وصنفه).
 * لو الاسم الجديد موجود قبل كده بيترفض (DUPLICATE_NAME) بدل ما نعمل منتجين بنفس الاسم.
 */
export function resolveItem(line: { item_id?: number | ''; name_ar?: string; name_en?: string; category_id?: number | '' }): { id: number; created: boolean } {
  if (line.item_id) return { id: line.item_id, created: false }
  const name_ar = String(line.name_ar ?? '').trim()
  if (!name_ar) throw new AppError('ITEM_REQUIRED')
  return { id: repo.insert(clean({ category_id: line.category_id || null, name_ar, name_en: line.name_en })), created: true }
}

/** صفحة تفاصيل المنتج: بياناته + ملخص + كل حركاته */
export function getDetails({ id }: { id: number }): ItemDetails {
  const item = repo.findById(id)
  if (!item) throw new AppError('ITEM_NOT_FOUND')
  const movements = findMovements(id).map((m) => ({ ...m, total: round2(m.quantity * m.unit_price) }))

  const sum = (type: string, fn: (m: (typeof movements)[number]) => number) =>
    movements.filter((m) => m.type === type).reduce((acc, m) => acc + fn(m), 0)
  const qtyOf = (type: string) => sum(type, (m) => m.quantity)
  const profitOf = (type: string) => sum(type, (m) => m.quantity * (m.unit_price - m.unit_cost))

  // الفرق بين الكمية الحالية وصافي الحركات = كميات افتتاحية أو تعديلات يدوية من فورم المنتج
  const adjustments = {} as Record<Condition, number>
  for (const cond of CONDITIONS) {
    const net = movements.filter((m) => m.condition === cond).reduce((acc, m) => acc + m.direction * m.quantity, 0)
    adjustments[cond] = item[`${cond}_quantity`] - net
  }

  return {
    item,
    totals: {
      purchased_qty: qtyOf('purchase'),
      sold_qty: qtyOf('sale'),
      sale_returns_qty: qtyOf('sale_return'),
      purchase_returns_qty: qtyOf('purchase_return'),
      purchases_cost: round2(sum('purchase', (m) => m.quantity * m.unit_cost)),
      sales_total: round2(sum('sale', (m) => m.quantity * m.unit_price)),
      profit: round2(profitOf('sale') - profitOf('sale_return'))
    },
    adjustments,
    movements
  }
}
