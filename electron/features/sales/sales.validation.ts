import type { Condition, PriceType, SaleInput, ShippingPayer } from '@shared/types'
import { AppError, money, optionalMoney, parseCondition, qty, today } from '../../lib/errors'
import { findById as findCustomer } from '../customers/customers.repository'

export interface CleanLine {
  item_id: number
  condition: Condition
  quantity: number
  selling_price: number | null
}

export interface CleanSale {
  customerId: number | null
  date: string
  priceType: PriceType
  payer: ShippingPayer
  shipping: number
  notes: string | null
  lines: CleanLine[]
}

/** فحص مدخلات الفاتورة وتحويلها لأرقام */
export function cleanSale(input: SaleInput): CleanSale {
  if (!Array.isArray(input.items) || input.items.length === 0) throw new AppError('NO_LINES')
  const customerId = input.customer_id ? Number(input.customer_id) : null
  if (customerId && !findCustomer(customerId)) throw new AppError('CUSTOMER_NOT_FOUND')
  return {
    customerId,
    date: input.sale_date || today(),
    priceType: input.price_type === 'wholesale' ? 'wholesale' : 'retail',
    payer: input.shipping_payer === 'shop' ? 'shop' : 'customer',
    shipping: money(input.shipping_cost),
    notes: input.notes || null,
    lines: input.items.map((l) => ({
      item_id: l.item_id,
      condition: parseCondition(l.condition),
      quantity: qty(l.quantity),
      selling_price: optionalMoney(l.selling_price)
    }))
  }
}
