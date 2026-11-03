import type { Condition, PurchaseInput } from '@shared/types'
import { AppError, money, optionalMoney, parseCondition, qty, round2, today } from '../../lib/errors'
import { cleanPartner } from '../sales/sales.validation'

export interface CleanLine {
  raw: PurchaseInput['items'][number]
  condition: Condition
  quantity: number
  purchase_price: number
  selling_price: number | null
  wholesale_price: number | null
}

export interface CleanPurchase {
  supplier_name: string
  /** الشريك اللي اشترى (في الشراكة لازم، وفي المخزون الفعلي null) */
  partnerId: number | null
  /** الشريك دفعها من جيبه (في الشراكة بس) */
  paidByPartner: boolean
  date: string
  shipping: number
  notes: string | null
  subtotal: number
  total: number
  lines: CleanLine[]
}

/** فحص مدخلات الفاتورة وحساب إجماليها */
export function cleanPurchase(input: PurchaseInput): CleanPurchase {
  const supplier_name = String(input.supplier_name ?? '').trim()
  if (!supplier_name) throw new AppError('SUPPLIER_REQUIRED')
  if (!Array.isArray(input.items) || input.items.length === 0) throw new AppError('NO_LINES')

  const shipping = money(input.shipping_cost)
  const lines: CleanLine[] = input.items.map((l) => ({
    raw: l, // بيانات المنتج (id أو اسم + صنف) علشان نحدده جوه الـ transaction
    condition: parseCondition(l.condition),
    quantity: qty(l.quantity),
    purchase_price: money(l.purchase_price),
    selling_price: optionalMoney(l.selling_price),
    wholesale_price: optionalMoney(l.wholesale_price)
  }))
  const subtotal = lines.reduce((sum, l) => sum + l.quantity * l.purchase_price, 0)
  const partnerId = cleanPartner(input.partner_id)
  return { supplier_name, partnerId, paidByPartner: partnerId !== null && !!input.paid_by_partner, date: input.purchase_date || today(), shipping, notes: input.notes || null, subtotal, total: round2(subtotal + shipping), lines }
}
