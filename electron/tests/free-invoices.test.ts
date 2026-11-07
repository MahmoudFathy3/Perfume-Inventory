import assert from 'node:assert/strict'
import test from 'node:test'
import type { FreeInvoiceInput } from '@shared/types'
import * as categories from '../features/categories/categories.service'
import * as customers from '../features/customers/customers.service'
import * as dashboard from '../features/dashboard/dashboard.service'
import * as free from '../features/freeInvoices/freeInvoices.service'
import * as items from '../features/items/items.service'
import * as sales from '../features/sales/sales.service'
import * as ws from '../features/workspaces/workspaces.service'
import { withWorkspace } from '../lib/workspace'
import { err, stockOf, useTestDb } from './helpers'

useTestDb()

const zero = { quantity: 0, purchase_price: 0, selling_price: 0, wholesale_price: 0 }
let oud = 0 // في المخزون الفعلي: 10 قطع، تكلفة 100، بيع 300
let ali = 0
let invoiceId = 0

/** فاتورة: عود من المخزون (2 × 300) + مسك من برّه (1 × 150) + شحن 50 − خصم 20 = 780 */
const input = (extra: Partial<FreeInvoiceInput> = {}): FreeInvoiceInput => ({
  customer_id: ali,
  invoice_date: '2030-03-10',
  shipping_cost: 50,
  discount: 20,
  items: [
    { item_id: oud, condition: 'new', quantity: 2, unit_price: 300 },
    { name: 'مسك من محل أحمد', quantity: 1, unit_price: 150 }
  ],
  ...extra
})

test('تجهيز', () => {
  const c = categories.createCategory({ name: 'عطور' })
  oud = items.createItem({ category_id: c, name_ar: 'عود', stock: { new: { quantity: 10, purchase_price: 100, selling_price: 300, wholesale_price: 0 }, damaged: zero } })
  ali = customers.createCustomer({ name: 'علي', phone: '0100' })
})

test('الفاتورة الحرّة: التوتال بالشحن والخصم، ومن غير أي أثر على المخزون أو المبيعات أو الربح', () => {
  const before = dashboard.summary()
  invoiceId = free.createFreeInvoice(input({ paid: 500 }))
  const f = free.getFreeInvoice({ id: invoiceId })
  assert.deepEqual([f.total, f.paid, f.remaining, f.customer_name, f.customer_phone, f.stock_lines, f.lines_count], [780, 500, 280, 'علي', '0100', 1, 2])
  assert.deepEqual(f.items.map((l) => [l.name, l.item_id, l.condition]), [['عود', oud, 'new'], ['مسك من محل أحمد', null, null]])

  assert.equal(stockOf(oud, 'new').quantity, 10, 'المخزون زي ما هو')
  const after = dashboard.summary()
  assert.deepEqual([after.sales.count, after.profit, after.receivables], [before.sales.count, before.profit, before.receivables])
})

test('المدفوع الافتراضي كله، والعميل ممكن يتكتب من غير ما يتسجل، وفحص المدخلات', () => {
  const id = free.createFreeInvoice(input({ customer_id: null, customer_name: ' زبون ', customer_phone: '0111' }))
  const f = free.getFreeInvoice({ id })
  assert.deepEqual([f.paid, f.remaining, f.customer_name, f.customer_id], [780, 0, 'زبون', null])

  assert.equal(err(() => free.createFreeInvoice(input({ items: [] }))), 'NO_LINES')
  assert.equal(err(() => free.createFreeInvoice(input({ items: [{ name: ' ', quantity: 1, unit_price: 1 }] }))), 'NAME_REQUIRED')
  assert.equal(err(() => free.createFreeInvoice(input({ items: [{ item_id: 99999, quantity: 1, unit_price: 1 }] }))), 'ITEM_NOT_FOUND')
  assert.equal(err(() => free.createFreeInvoice(input({ discount: 2000 }))), 'DISCOUNT_TOO_BIG')
  assert.equal(err(() => free.createFreeInvoice(input({ paid: 9999 }))), 'PAID_EXCEEDS_TOTAL')
  free.removeFreeInvoice({ id })
  assert.equal(err(() => free.getFreeInvoice({ id })), 'INVOICE_NOT_FOUND')
})

test('الدفعات: اتدفع والباقي زي المبيعات', () => {
  assert.equal(err(() => free.payFreeInvoice({ invoice_id: invoiceId, amount: 300 })), 'PAYMENT_EXCEEDS_REMAINING')
  const paymentId = free.payFreeInvoice({ invoice_id: invoiceId, amount: 280, payment_date: '2030-03-12' })
  assert.equal(free.getFreeInvoice({ id: invoiceId }).remaining, 0)
  assert.equal(err(() => free.payFreeInvoice({ invoice_id: invoiceId, amount: 1 })), 'NOTHING_DUE')
  free.removeFreeInvoicePayment({ id: paymentId })
  assert.equal(free.getFreeInvoice({ id: invoiceId }).remaining, 280)
  // الإجمالي الجديد مينفعش يقل عن المدفوع
  assert.equal(err(() => free.updateFreeInvoice({ id: invoiceId, ...input({ items: [{ name: 'حاجة', quantity: 1, unit_price: 100 }] }) })), 'TOTAL_BELOW_PAID')
})

test('سجّل بيع: فاتورة بيع حقيقية من بنود المخزون بس (القطع بتتخصم)، ومرة واحدة', () => {
  const saleId = free.createSaleFromFreeInvoice({ id: invoiceId, notes: 'من فاتورة حرة' })
  const sale = sales.getSale({ id: saleId })!
  assert.deepEqual([sale.total, sale.customer_id, sale.sale_date, sale.remaining], [600, ali, '2030-03-10', 0], 'العود بس، ومدفوعة كلها افتراضي')
  assert.equal(stockOf(oud, 'new').quantity, 8)
  assert.equal(free.getFreeInvoice({ id: invoiceId }).sale_id, saleId)
  assert.equal(err(() => free.createSaleFromFreeInvoice({ id: invoiceId })), 'FREE_INVOICE_HAS_SALE')

  // بعد البيع: سطر المخزون مبيتغيّرش من هنا، والبنود اللي من برّه عادي
  const changedStock = input({ items: [{ item_id: oud, condition: 'new', quantity: 3, unit_price: 300 }, { name: 'مسك من محل أحمد', quantity: 1, unit_price: 150 }] })
  assert.equal(err(() => free.updateFreeInvoice({ id: invoiceId, ...changedStock })), 'FREE_INVOICE_HAS_SALE')
  free.updateFreeInvoice({ id: invoiceId, ...input({ items: [{ item_id: oud, condition: 'new', quantity: 2, unit_price: 300 }, { name: 'مسك', quantity: 2, unit_price: 150 }] }) })
  assert.equal(free.getFreeInvoice({ id: invoiceId }).total, 930)

  // حذف فاتورة البيع بيشيل الربط (والقطع بترجع)
  sales.removeSale({ id: saleId })
  assert.equal(free.getFreeInvoice({ id: invoiceId }).sale_id, null)
  assert.equal(stockOf(oud, 'new').quantity, 10)
})

test('سجّل بيع: من غير بنود مخزون بيترفض، ولو مش مدفوعة كلها لازم عميل متسجل', () => {
  const external = free.createFreeInvoice(input({ items: [{ name: 'حاجة', quantity: 1, unit_price: 100 }], discount: 0 }))
  assert.equal(err(() => free.createSaleFromFreeInvoice({ id: external })), 'NO_STOCK_LINES')

  const noCustomer = free.createFreeInvoice(input({ customer_id: null, customer_name: 'زبون' }))
  assert.equal(err(() => free.createSaleFromFreeInvoice({ id: noCustomer, paid: 100 })), 'CUSTOMER_REQUIRED')
  assert.equal(free.getFreeInvoice({ id: noCustomer }).sale_id, null, 'الرفض مبيسيبش أثر')
  assert.equal(stockOf(oud, 'new').quantity, 10)
})

test('البحث بالعميل أو باسم بند، وفلتر التاريخ', () => {
  const found = (search: string) => free.pageFreeInvoices({ search, page: 1, pageSize: 50 }).rows.some((r) => r.id === invoiceId)
  assert.ok(found('علي'), 'باسم العميل')
  assert.ok(found('مسك'), 'باسم بند من برّه')
  assert.ok(!found('حاجة مش موجودة'))
  assert.equal(free.pageFreeInvoices({ from: '2031-01-01', page: 1, pageSize: 50 }).rows.length, 0)
})

test('في المخزون الفعلي بس', () => {
  const shop = ws.createWorkspace({ partners: ['أ', 'ب'] })
  assert.equal(err(() => withWorkspace(shop, () => free.pageFreeInvoices({ page: 1, pageSize: 10 }))), 'PERSONAL_ONLY')
})
