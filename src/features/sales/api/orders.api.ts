import type { Condition, ConfirmOrderInput, DateFilter, Page, PageParams, SaleInput, SaleOrder, SaleOrderWithLines, SaleWithLines } from '@shared/types'
import { invoke } from '@/shared/api/ipc'

/** فواتير تحت التجهيز (طلبات لسه ما اتباعتش) */
export const ordersApi = {
  page: (p: { search?: string } & DateFilter & PageParams) => invoke<Page<SaleOrder>>('orders:page', p),
  count: () => invoke<number>('orders:count'),
  get: (p: { id: number }) => invoke<SaleOrderWithLines>('orders:get', p),
  /** paid = العربون */
  create: (p: SaleInput) => invoke<number>('orders:create', p),
  update: (p: SaleInput & { id: number }) => invoke<void>('orders:update', p),
  remove: (p: { id: number }) => invoke<void>('orders:remove', p),
  /** "اتباعت": فاتورة بيع عادية (بيرجّع رقمها) */
  confirm: (p: ConfirmOrderInput) => invoke<number>('orders:confirm', p),
  /** رجوع فاتورة بيع لتحت التجهيز (بيرجّع رقم الطلب) */
  fromSale: (p: { id: number }) => invoke<number>('orders:from-sale', p),
  /** المحجوز في منتجات المخزن النشط: القطع وقيمتها بسعر الطلب وعدد المنتجات والطلبات */
  reserved: () => invoke<{ pieces: number; value: number; items: number; orders: number }>('orders:reserved'),
  /** الطلبات اللي حاجزة منتج */
  forItem: (p: { item_id: number }) =>
    invoke<{ order_id: number; workspace_id: number; order_date: string; customer_name: string | null; condition: Condition; quantity: number; selling_price: number }[]>('orders:for-item', p)
}

/**
 * الطلب بشكل فاتورة بيع علشان فورم البيع يفتحه للتعديل (بيستخدم السطور والعميل والشحن والملاحظات،
 * و paid = العربون). باقي حقول الفاتورة (المرتجع والرصيد...) ملهاش معنى في الطلب فبتبقى صفر.
 */
export function orderToSale(o: SaleOrderWithLines): SaleWithLines {
  return {
    id: o.id,
    customer_id: o.customer_id,
    customer_name: o.customer_name,
    partner_id: o.partner_id,
    partner_name: o.partner_name,
    sale_date: o.order_date,
    price_type: o.price_type,
    shipping_payer: o.shipping_payer,
    shipping_cost: o.shipping_cost,
    total: o.total,
    notes: o.notes,
    paid: o.deposit,
    items: o.items.map((l) => ({
      item_id: l.item_id,
      source_item_id: null,
      name_ar: l.name_ar,
      name_en: l.name_en,
      category_id: l.category_id,
      condition: l.condition,
      quantity: l.quantity,
      selling_price: l.selling_price,
      purchase_price: 0,
      source_workspace_id: l.source_workspace_id,
      transfer_price: l.transfer_price
    })),
    payments: []
  } as unknown as SaleWithLines
}
