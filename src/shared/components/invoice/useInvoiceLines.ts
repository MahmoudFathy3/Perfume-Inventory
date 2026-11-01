import { useState } from 'react'
import type { Condition, Item, PriceType, PurchaseLineInput, PurchaseWithLines, SaleLineInput, SaleWithLines } from '@shared/types'
import { bilingualName } from '../../utils/format'

/** حالة سطر في الفاتورة (كل الأرقام نصوص لأنها جاية من خانات الكتابة) */
export interface LineState {
  item_id: number | ''
  /** اسم منتج جديد (في المشتريات بس) وصنفه */
  name: string
  name_en: string
  category_id: number | ''
  /** اسم المنتج لو مش في القايمة (مؤرشف وهو في فاتورة قديمة بتتعدّل) */
  label?: string
  condition: Condition
  quantity: string
  purchase_price: string
  selling_price: string
  wholesale_price: string
}

export type InvoiceKind = 'purchase' | 'sale'

const emptyLine = (): LineState => ({
  item_id: '', name: '', name_en: '', category_id: '', condition: 'new',
  quantity: '1', purchase_price: '', selling_price: '', wholesale_price: ''
})

const rounded = (n: number) => (Math.round(n * 100) / 100 || '').toString()
const show = (n: number) => (n ? String(n) : '')

/** الأسعار الحالية للمنتج بحسب الحالة (جديد / تالف) ونوع الفاتورة */
function pricesFor(item: Item, condition: Condition, kind: InvoiceKind, priceType: PriceType): Partial<LineState> {
  const retail = show(item[`${condition}_selling_price`])
  const wholesale = show(item[`${condition}_wholesale_price`])
  if (kind === 'purchase') {
    return { purchase_price: rounded(item[`${condition}_purchase_price`]), selling_price: retail, wholesale_price: wholesale }
  }
  return { selling_price: priceType === 'wholesale' && wholesale ? wholesale : retail }
}

// ---------- تحويل فاتورة موجودة لسطور الفورم (للتعديل) ----------
export function purchaseToLines(purchase: PurchaseWithLines): LineState[] {
  return purchase.items.map((l) => ({
    item_id: l.item_id, name: '', name_en: '', category_id: l.category_id, label: bilingualName(l), condition: l.condition,
    quantity: String(l.quantity), purchase_price: String(l.purchase_price), selling_price: show(l.selling_price), wholesale_price: show(l.wholesale_price)
  }))
}

export function saleToLines(sale: SaleWithLines): LineState[] {
  return sale.items.map((l) => ({
    item_id: l.item_id, name: '', name_en: '', category_id: l.category_id, label: bilingualName(l), condition: l.condition,
    quantity: String(l.quantity), purchase_price: '', selling_price: String(l.selling_price), wholesale_price: ''
  }))
}

/**
 * سطور الفاتورة (شراء أو بيع): إضافة وحذف وتعديل، وتعبئة الأسعار تلقائيًا من المنتج.
 * priceType بس للبيع (قطاعي / جملة). initial = سطور فاتورة موجودة (وضع التعديل).
 */
export function useInvoiceLines(kind: InvoiceKind, items: Item[], priceType: PriceType = 'retail', initial?: LineState[]) {
  const [lines, setLines] = useState<LineState[]>(initial && initial.length > 0 ? initial : [emptyLine()])
  const findItem = (id: number | '') => (id ? items.find((i) => i.id === id) : undefined)

  function update(index: number, patch: Partial<LineState>): void {
    setLines((current) =>
      current.map((line, i) => {
        if (i !== index) return line
        const next = { ...line, ...patch }
        // لما المنتج أو الحالة يتغيروا بنعبّي الأسعار الحالية (وتقدر تعدّلها)
        const item = 'item_id' in patch || 'condition' in patch ? findItem(next.item_id) : undefined
        return item ? { ...next, ...pricesFor(item, next.condition, kind, priceType) } : next
      })
    )
  }

  /** لما نوع السعر يتغير (قطاعي / جملة) بنعيد تعبئة سعر كل سطر */
  function reprice(type: PriceType): void {
    setLines((current) =>
      current.map((line) => {
        const item = findItem(line.item_id)
        return item ? { ...line, ...pricesFor(item, line.condition, kind, type) } : line
      })
    )
  }

  const add = () => setLines((current) => [...current, emptyLine()])
  const remove = (index: number) => setLines((current) => current.filter((_, i) => i !== index))

  const unitPrice = (l: LineState) => Number(kind === 'purchase' ? l.purchase_price : l.selling_price) || 0
  const subtotal = lines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * unitPrice(l), 0)

  return { lines, update, reprice, add, remove, subtotal, findItem }
}

export type InvoiceLines = ReturnType<typeof useInvoiceLines>

// ---------- تحويل سطور الفورم لمدخلات الـ backend ----------
export function toPurchaseLines(lines: LineState[]): PurchaseLineInput[] {
  return lines.map((l) => {
    if (!l.item_id && !l.name) throw new Error('ITEM_REQUIRED')
    return {
      ...(l.item_id ? { item_id: l.item_id } : { name_ar: l.name, name_en: l.name_en, category_id: l.category_id }),
      condition: l.condition,
      quantity: l.quantity,
      purchase_price: l.purchase_price,
      selling_price: l.selling_price,
      wholesale_price: l.wholesale_price
    }
  })
}

export function toSaleLines(lines: LineState[]): SaleLineInput[] {
  return lines.map((l) => {
    if (!l.item_id) throw new Error('ITEM_REQUIRED')
    return { item_id: l.item_id, condition: l.condition, quantity: l.quantity, selling_price: l.selling_price }
  })
}
