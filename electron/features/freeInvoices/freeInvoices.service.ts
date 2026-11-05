/**
 * الفواتير الحرّة (في المخزون الفعلي بس): فاتورة للعميل فيها بنود من المخزون أو من برّه (شغل ناس تانية)
 * علشان يشوف التوتال، من غير أي أثر على المخزون ولا المبيعات ولا الربح ولا حسابات العملاء.
 * ليها دفعات لوحدها (اتدفع / الباقي) زي فاتورة البيع.
 * "سجّل بيع": بيعمل فاتورة بيع حقيقية من بنود المخزون بس (القطع بتتخصم والربح بيتحسب) ويربطها بالفاتورة.
 */
import type { DateFilter, FreeInvoiceInput, FreeInvoicePaymentInput, FreeInvoiceToSaleInput, FreeInvoiceWithLines, PageParams } from '@shared/types'
import { getDb } from '../../database/connection'
import { AppError, money, parseCondition, positiveAmount, qty, round2, today } from '../../lib/errors'
import { activeWorkspaceId, PERSONAL_WORKSPACE_ID } from '../../lib/workspace'
import { createSale } from '../sales/sales.service'
import * as repo from './freeInvoices.repository'

const EPS = 0.005

/** الفواتير الحرّة في المخزون الفعلي بس */
function assertPersonal(): void {
  if (activeWorkspaceId() !== PERSONAL_WORKSPACE_ID) throw new AppError('PERSONAL_ONLY')
}

function found(id: number) {
  const invoice = repo.findById(Number(id))
  if (!invoice) throw new AppError('INVOICE_NOT_FOUND')
  return invoice
}

/** فحص الفاتورة: سطر واحد على الأقل، كل سطر ليه اسم (أو منتج من المخزون) وكمية وسعر، والخصم مش أكبر من الفاتورة */
function clean(input: FreeInvoiceInput): { header: repo.HeaderRow; lines: repo.LineRow[] } {
  if (!Array.isArray(input.items) || input.items.length === 0) throw new AppError('NO_LINES')
  const lines = input.items.map((l): repo.LineRow => {
    const itemId = l.item_id ? Number(l.item_id) : null
    const typed = String(l.name ?? '').trim()
    if (itemId === null) {
      if (!typed) throw new AppError('NAME_REQUIRED')
      return { item_id: null, condition: null, name: typed, quantity: qty(l.quantity), unit_price: money(l.unit_price) }
    }
    const item = repo.findItem(itemId, PERSONAL_WORKSPACE_ID)
    if (!item) throw new AppError('ITEM_NOT_FOUND')
    return { item_id: itemId, condition: parseCondition(l.condition ?? 'new'), name: typed || item.name_ar, quantity: qty(l.quantity), unit_price: money(l.unit_price) }
  })

  const customerId = input.customer_id ? Number(input.customer_id) : null
  if (customerId !== null && !repo.customerExists(customerId, PERSONAL_WORKSPACE_ID)) throw new AppError('CUSTOMER_NOT_FOUND')
  const subtotal = lines.reduce((sum, l) => sum + l.quantity * l.unit_price, 0)
  const shipping = money(input.shipping_cost ?? 0)
  const discount = money(input.discount ?? 0)
  if (discount > subtotal + shipping + EPS) throw new AppError('DISCOUNT_TOO_BIG')

  return {
    header: {
      invoice_date: input.invoice_date || today(),
      customer_id: customerId,
      // العميل المتسجل اسمه بيتاخد من حسابه
      customer_name: customerId ? null : String(input.customer_name ?? '').trim() || null,
      customer_phone: String(input.customer_phone ?? '').trim() || null,
      price_type: input.price_type === 'wholesale' ? 'wholesale' : 'retail',
      shipping_cost: shipping,
      discount,
      total: round2(subtotal + shipping - discount),
      notes: String(input.notes ?? '').trim() || null
    },
    lines
  }
}

export function pageFreeInvoices(p: { search?: string } & DateFilter & PageParams) {
  assertPersonal()
  return repo.findPage(p, p)
}

export function getFreeInvoice({ id }: { id: number }): FreeInvoiceWithLines {
  assertPersonal()
  const invoice = found(id)
  return { ...invoice, items: repo.findLines(invoice.id), payments: repo.findPayments(invoice.id) }
}

/** فاتورة جديدة. المدفوع الافتراضي = الفاتورة كلها */
export function createFreeInvoice(input: FreeInvoiceInput): number {
  assertPersonal()
  const { header, lines } = clean(input)
  const paid = input.paid === undefined || input.paid === '' ? header.total : round2(money(input.paid))
  if (paid > header.total + EPS) throw new AppError('PAID_EXCEEDS_TOTAL')
  return getDb().transaction(() => {
    const id = repo.insertHeader(header)
    repo.replaceLines(id, lines)
    if (paid > 0) repo.insertPayment(id, paid, header.invoice_date, null)
    return id
  })()
}

/** نفس سطر المخزون؟ (بعد ما اتعمل منه فاتورة بيع مبيتغيّرش من هنا) */
const stockKey = (l: { item_id: number | null; condition: string | null; quantity: number; unit_price: number }) =>
  `${l.item_id}|${l.condition}|${l.quantity}|${round2(l.unit_price)}`

/**
 * تعديل: الدفعات بتفضل زي ما هي (والإجمالي الجديد مينفعش يقل عنها).
 * لو اتعمل منها فاتورة بيع: سطور المخزون مبتتغيّرش من هنا (عدّل فاتورة البيع، أو احذفها والربط بيتشال)، والبنود اللي من برّه عادي.
 */
export function updateFreeInvoice({ id, ...input }: FreeInvoiceInput & { id: number }): void {
  assertPersonal()
  const old = found(id)
  const { header, lines } = clean(input)
  if (old.sale_id) {
    const before = repo.findLines(old.id).filter((l) => l.item_id !== null).map(stockKey).sort()
    const after = lines.filter((l) => l.item_id !== null).map(stockKey).sort()
    if (before.join() !== after.join()) throw new AppError('FREE_INVOICE_HAS_SALE')
  }
  if (repo.sumPayments(old.id) > header.total + EPS) throw new AppError('TOTAL_BELOW_PAID')
  getDb().transaction(() => {
    repo.updateHeader(old.id, header)
    repo.replaceLines(old.id, lines)
  })()
}

/** حذف الفاتورة ودفعاتها. فاتورة البيع اللي اتعملت منها بتفضل زي ما هي */
export function removeFreeInvoice({ id }: { id: number }): void {
  assertPersonal()
  repo.remove(found(id).id)
}

export function payFreeInvoice(input: FreeInvoicePaymentInput): number {
  assertPersonal()
  const invoice = found(input.invoice_id)
  if (invoice.remaining <= EPS) throw new AppError('NOTHING_DUE')
  const amount = positiveAmount(input.amount)
  if (amount > invoice.remaining + EPS) throw new AppError('PAYMENT_EXCEEDS_REMAINING')
  return repo.insertPayment(invoice.id, amount, input.payment_date || today(), String(input.notes ?? '').trim() || null)
}

export function removeFreeInvoicePayment({ id }: { id: number }): void {
  assertPersonal()
  if (!repo.findPayment(Number(id))) throw new AppError('PAYMENT_NOT_FOUND')
  repo.removePayment(Number(id))
}

/**
 * فاتورة بيع حقيقية من بنود المخزون اللي في الفاتورة (بنفس الكميات والأسعار والتاريخ والعميل):
 * القطع بتتخصم من المخزون والربح بيتحسب. البنود اللي من برّه والشحن والخصم بيفضلوا في الفاتورة الحرّة بس.
 * المدفوع الافتراضي = فاتورة البيع كلها، ولو مش كلها لازم الفاتورة يكون عليها عميل متسجل.
 */
export function createSaleFromFreeInvoice({ id, paid, notes }: FreeInvoiceToSaleInput): number {
  assertPersonal()
  const invoice = found(id)
  if (invoice.sale_id) throw new AppError('FREE_INVOICE_HAS_SALE')
  const stock = repo.findLines(invoice.id).filter((l) => l.item_id !== null)
  if (stock.length === 0) throw new AppError('NO_STOCK_LINES')
  return getDb().transaction(() => {
    const saleId = createSale({
      customer_id: invoice.customer_id,
      sale_date: invoice.invoice_date,
      price_type: invoice.price_type,
      shipping_cost: 0,
      paid,
      notes: String(notes ?? '').trim() || undefined,
      items: stock.map((l) => ({ item_id: l.item_id!, condition: l.condition ?? 'new', quantity: l.quantity, selling_price: l.unit_price }))
    })
    repo.setSale(invoice.id, saleId)
    return saleId
  })()
}
