import type { Condition, PriceType, SaleInput, ShippingPayer } from '@shared/types'
import { AppError, money, optionalMoney, parseCondition, qty, today } from '../../lib/errors'
import { activeWorkspaceId } from '../../lib/workspace'
import { findById as findCustomer } from '../customers/customers.repository'
import { findById as findWorkspace, findPartners } from '../workspaces/workspaces.repository'

export interface CleanLine {
  item_id: number
  condition: Condition
  quantity: number
  selling_price: number | null
  /** مخزن تاني (المخزون الفعلي ↔ شراكة) السطر جاي منه. null = مخزن الفاتورة */
  source: number | null
  /** سعر التحويل للمخزن التاني (null = سعر البيع) */
  transfer_price: number | null
  /** بيتحدد بعد التحويل: المنتج في المخزن التاني، وتكلفة السطر في مخزن الفاتورة (= سعر التحويل) */
  source_item_id?: number
  cost?: number
}

export interface CleanSale {
  customerId: number | null
  /** الشريك اللي عمل الفاتورة (في الشراكة لازم، وفي المخزون الفعلي null) */
  partnerId: number | null
  date: string
  priceType: PriceType
  payer: ShippingPayer
  shipping: number
  notes: string | null
  lines: CleanLine[]
}

/** في الشراكة لازم نعرف مين من الشركاء اللي باع (أو اشترى في فواتير الشراء). في المخزون الفعلي null */
export function cleanPartner(value: unknown): number | null {
  const ws = activeWorkspaceId()
  if (findWorkspace(ws)?.kind !== 'partnership') return null
  const id = Number(value)
  if (!id) throw new AppError('PARTNER_REQUIRED')
  if (!findPartners(ws).some((p) => p.id === id)) throw new AppError('PARTNER_NOT_FOUND')
  return id
}

/** فحص مدخلات الفاتورة وتحويلها لأرقام */
export function cleanSale(input: SaleInput): CleanSale {
  if (!Array.isArray(input.items) || input.items.length === 0) throw new AppError('NO_LINES')
  const customerId = input.customer_id ? Number(input.customer_id) : null
  if (customerId && !findCustomer(customerId)) throw new AppError('CUSTOMER_NOT_FOUND')
  return {
    customerId,
    partnerId: cleanPartner(input.partner_id),
    date: input.sale_date || today(),
    priceType: input.price_type === 'wholesale' ? 'wholesale' : 'retail',
    payer: input.shipping_payer === 'shop' ? 'shop' : 'customer',
    shipping: money(input.shipping_cost),
    notes: input.notes || null,
    lines: input.items.map((l) => ({
      item_id: l.item_id,
      condition: parseCondition(l.condition),
      quantity: qty(l.quantity),
      selling_price: optionalMoney(l.selling_price),
      source: l.source_workspace_id && Number(l.source_workspace_id) !== activeWorkspaceId() ? Number(l.source_workspace_id) : null,
      transfer_price: optionalMoney(l.transfer_price)
    }))
  }
}
