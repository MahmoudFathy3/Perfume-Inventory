/**
 * فواتير "تحت التجهيز": طلب بيع لسه ما اتباعش (العميل طلب والبضاعة بتتجهّز).
 * - مبيتخصمش من المخزون، ومش داخل في المبيعات ولا الربح ولا حساب العميل، والقطع بتظهر "محجوزة" في منتجاتها.
 * - العربون بيتسجل على الطلب، ولما يتباع بيتحسب دفعة من الفاتورة.
 * - "اتباعت": بيتحول لفاتورة بيع عادية بتاريخ البيع (القطع بتتخصم ساعتها، ولو مش كفاية بيترفض) والطلب بيتمسح.
 * - إلغاء: الطلب بيتمسح والحجز بيتشال.
 */
import type { ConfirmOrderInput, DateFilter, PageParams, SaleInput, SaleOrderWithLines } from '@shared/types'
import { getDb } from '../../database/connection'
import { AppError, money, round2, today } from '../../lib/errors'
import { activeWorkspaceId } from '../../lib/workspace'
import { createSale, getSale, removeSale } from '../sales/sales.service'
import { cleanSale } from '../sales/sales.validation'
import * as repo from './saleOrders.repository'

const EPS = 0.005

function found(id: number) {
  const order = repo.findById(Number(id), activeWorkspaceId())
  if (!order) throw new AppError('ORDER_NOT_FOUND')
  return order
}

/** نفس فحص فاتورة البيع، وكل سطر لازم يكون ليه سعر (لو مفيش بناخد سعر المنتج) */
function clean(input: SaleInput): { order: repo.OrderRow; lines: repo.OrderLineRow[] } {
  const ws = activeWorkspaceId()
  const c = cleanSale(input)
  const lines = c.lines.map((l): repo.OrderLineRow => {
    if (!repo.itemInWorkspace(l.item_id, l.source ?? ws)) throw new AppError('ITEM_NOT_FOUND')
    const prices = repo.stockPrices(l.item_id, l.condition)
    const fallback = c.priceType === 'wholesale' && prices?.wholesale_price ? prices.wholesale_price : (prices?.selling_price ?? 0)
    const price = l.selling_price ?? fallback
    return { item_id: l.item_id, condition: l.condition, quantity: l.quantity, selling_price: price, source_workspace_id: l.source, transfer_price: l.source ? (l.transfer_price ?? price) : null }
  })
  const subtotal = lines.reduce((sum, l) => sum + l.quantity * l.selling_price, 0)
  const total = round2(subtotal + (c.payer === 'customer' ? c.shipping : 0))
  const deposit = input.paid === undefined || input.paid === '' ? 0 : round2(money(input.paid))
  if (deposit > total + EPS) throw new AppError('PAID_EXCEEDS_TOTAL')
  return {
    order: {
      order_date: c.date,
      customer_id: c.customerId,
      partner_id: c.partnerId,
      price_type: c.priceType,
      shipping_payer: c.payer,
      shipping_cost: c.shipping,
      total,
      deposit,
      notes: c.notes
    },
    lines
  }
}

export const pageOrders = (p: { search?: string } & DateFilter & PageParams) => repo.findPage(activeWorkspaceId(), p, p)
export const countOrders = () => repo.count(activeWorkspaceId())

export function getOrder({ id }: { id: number }): SaleOrderWithLines {
  const order = found(id)
  return { ...order, items: repo.findLines(order.id) }
}

/** طلب جديد: paid في المدخلات = العربون (الافتراضي مفيش) */
export const createOrder = (input: SaleInput): number =>
  getDb().transaction(() => {
    const { order, lines } = clean(input)
    const id = repo.insert(activeWorkspaceId(), order)
    repo.replaceLines(id, lines)
    return id
  })()

export const updateOrder = ({ id, ...input }: SaleInput & { id: number }): void =>
  getDb().transaction(() => {
    const old = found(id)
    const { order, lines } = clean(input)
    repo.update(old.id, order)
    repo.replaceLines(old.id, lines)
  })()

/** إلغاء الطلب: بيتمسح والحجز بيتشال (العربون بيترد للعميل برا البرنامج) */
export function removeOrder({ id }: { id: number }): void {
  repo.remove(found(id).id)
}

/**
 * "اتباعت": فاتورة بيع عادية بنفس الطلب بتاريخ البيع (الافتراضي النهارده): القطع بتتخصم (والقطع من مخزن تاني بتتحوّل)،
 * والمدفوع = العربون + اللي اتدفع دلوقتي (الافتراضي الباقي كله). لو مش مدفوعة كلها لازم عميل متسجل. بيرجّع رقم الفاتورة.
 */
export const confirmOrder = ({ id, sale_date, paid }: ConfirmOrderInput): number =>
  getDb().transaction(() => {
    const order = getOrder({ id })
    const remaining = round2(order.total - order.deposit)
    const paidNow = paid === undefined || paid === '' ? remaining : round2(money(paid))
    if (paidNow > remaining + EPS) throw new AppError('PAID_EXCEEDS_TOTAL')
    const saleId = createSale({
      customer_id: order.customer_id,
      partner_id: order.partner_id,
      sale_date: sale_date || today(),
      price_type: order.price_type,
      shipping_payer: order.shipping_payer,
      shipping_cost: order.shipping_cost,
      notes: order.notes ?? undefined,
      paid: round2(order.deposit + paidNow),
      items: order.items.map((l) => ({
        item_id: l.item_id,
        condition: l.condition,
        quantity: l.quantity,
        selling_price: l.selling_price,
        ...(l.source_workspace_id ? { source_workspace_id: l.source_workspace_id, transfer_price: l.transfer_price ?? l.selling_price } : {})
      }))
    })
    repo.remove(order.id)
    return saleId
  })()

/**
 * رجوع فاتورة بيع لـ "تحت التجهيز" (اتعملت بالغلط أو الطلب لسه ما اتسلّمش): عكس "اتباعت" بالظبط.
 * القطع بترجع المخزون (زي حذف الفاتورة، والقطع اللي كانت من مخزن تاني بترجع له)، والفاتورة بتطلع من المبيعات والربح وحساب العميل،
 * وبيتعمل طلب بنفس البنود والعميل والأسعار، واللي العميل دفعه بيبقى العربون.
 * مينفعش لو عليها مرتجع (HAS_RETURNS) أو اتدفعت من رصيد العميل (مربوط بفواتير تانية) أو تاريخها في يوم / شهر مقفول. بيرجّع رقم الطلب.
 */
export const saleToOrder = ({ id }: { id: number }): number =>
  getDb().transaction(() => {
    const sale = getSale({ id: Number(id) }) // فواتير المخزن النشط بس
    if (!sale) throw new AppError('SALE_NOT_FOUND')
    if (sale.payments.some((p) => p.from_credit)) throw new AppError('SALE_PAID_FROM_CREDIT')
    const deposit = round2(Math.min(sale.total, Math.max(0, sale.paid)))
    const input: SaleInput = {
      customer_id: sale.customer_id,
      partner_id: sale.partner_id,
      sale_date: sale.sale_date,
      price_type: sale.price_type,
      shipping_payer: sale.shipping_payer,
      shipping_cost: sale.shipping_cost,
      notes: sale.notes ?? undefined,
      paid: deposit,
      // السطر اللي جه من مخزن تاني بيرجع لمنتجه هناك (بيتحجز فيه)
      items: sale.items.map((l) =>
        l.source_workspace_id && l.source_item_id
          ? { item_id: l.source_item_id, condition: l.condition, quantity: l.quantity, selling_price: l.selling_price, source_workspace_id: l.source_workspace_id, transfer_price: l.transfer_price ?? l.selling_price }
          : { item_id: l.item_id, condition: l.condition, quantity: l.quantity, selling_price: l.selling_price }
      )
    }
    removeSale({ id: sale.id }) // بيرجّع القطع ويشيل التحويلات والدفعات، وبيرفض المرتجع والمقفول
    return createOrder(input)
  })()

/** ملخص المحجوز في المخزن النشط (كارت الرئيسية) */
export const reservedSummary = () => repo.reservedSummary(activeWorkspaceId())

/** الطلبات اللي حاجزة منتج (تفاصيل المنتج): المنتج لازم يكون في المخزن النشط */
export function ordersForItem({ item_id }: { item_id: number }) {
  if (!repo.itemInWorkspace(Number(item_id), activeWorkspaceId())) return []
  return repo.ordersForItem(Number(item_id))
}
