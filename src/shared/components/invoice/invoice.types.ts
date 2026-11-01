import type { Condition, PriceType, PurchaseWithLines, ReturnWithLines, SaleWithLines, SettingsMap, ShippingPayer } from '@shared/types'

export type InvoiceKind = 'sale' | 'purchase' | 'sale_return' | 'purchase_return'

export interface InvoiceDocLine {
  name_ar: string
  name_en: string | null
  condition: Condition
  quantity: number
  unit_price: number
}

/** شكل موحّد لأي فاتورة / مرتجع علشان نعرضها ونطبعها بنفس المكوّن */
export interface InvoiceDocData {
  kind: InvoiceKind
  id: number
  date: string
  party: string | null
  priceType?: PriceType
  /** مين بيدفع الشحن (في البيع بس) */
  shippingPayer?: ShippingPayer
  shipping: number
  total: number
  notes: string | null
  /** المدفوع والمتبقي (فواتير البيع بس) */
  paid?: number
  remaining?: number
  lines: InvoiceDocLine[]
}

export type ShopInfo = Pick<SettingsMap, 'shop_name' | 'shop_phone' | 'shop_address'>

// ---------- تحويل رد الـ backend للشكل الموحّد ----------
export const fromPurchase = (p: PurchaseWithLines): InvoiceDocData => ({
  kind: 'purchase',
  id: p.id,
  date: p.purchase_date,
  party: p.supplier_name,
  shipping: p.shipping_cost,
  total: p.total,
  notes: p.notes,
  lines: p.items.map((l) => ({ name_ar: l.name_ar, name_en: l.name_en, condition: l.condition, quantity: l.quantity, unit_price: l.purchase_price }))
})

export const fromSale = (s: SaleWithLines): InvoiceDocData => ({
  kind: 'sale',
  id: s.id,
  date: s.sale_date,
  party: s.customer_name,
  priceType: s.price_type,
  shippingPayer: s.shipping_payer,
  shipping: s.shipping_cost,
  total: s.total,
  notes: s.notes,
  paid: s.paid,
  remaining: s.remaining,
  lines: s.items.map((l) => ({ name_ar: l.name_ar, name_en: l.name_en, condition: l.condition, quantity: l.quantity, unit_price: l.selling_price }))
})

export const fromReturn = (r: ReturnWithLines): InvoiceDocData => ({
  kind: r.type === 'sale' ? 'sale_return' : 'purchase_return',
  id: r.id,
  date: r.return_date,
  party: r.type === 'sale' ? r.customer_name : r.supplier_name,
  shipping: 0,
  total: r.total,
  notes: r.reason,
  lines: r.items.map((l) => ({ name_ar: l.name_ar, name_en: l.name_en, condition: l.condition, quantity: l.quantity, unit_price: l.unit_price }))
})
