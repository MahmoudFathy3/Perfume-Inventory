import assert from 'node:assert/strict'
import test from 'node:test'
import * as categories from '../features/categories/categories.service'
import * as customers from '../features/customers/customers.service'
import * as dashboard from '../features/dashboard/dashboard.service'
import * as items from '../features/items/items.service'
import * as payments from '../features/payments/payments.service'
import * as returns from '../features/returns/returns.service'
import * as sales from '../features/sales/sales.service'
import { err, useTestDb } from './helpers'

useTestDb()

const zero = { quantity: 0, purchase_price: 0, selling_price: 0, wholesale_price: 0 }
let oud = 0
let cust = 0
let first = 0 // فاتورة بـ 1000 (4 قطع × 250) اتدفعت كلها

const sale = (id: number) => sales.getSale({ id })!
const collected = () => dashboard.summary({}).collected
const returnOne = (saleId: number, quantity: number, refund?: number) =>
  returns.createReturn({ type: 'sale', sale_id: saleId, items: [{ item_id: oud, condition: 'new', quantity, unit_price: 250 }], ...(refund === undefined ? {} : { refund }) })

test('تجهيز: عميل اشترى بـ 1000 ودفعها كلها', () => {
  const c = categories.createCategory({ name: 'عود' })
  oud = items.createItem({ category_id: c, name_ar: 'عود', stock: { new: { quantity: 50, purchase_price: 100, selling_price: 250, wholesale_price: 200 }, damaged: zero } })
  cust = customers.createCustomer({ name: 'كريم' })
  first = sales.createSale({ customer_id: cust, items: [{ item_id: oud, condition: 'new', quantity: 4 }] })
  assert.deepEqual([sale(first).total, sale(first).paid, collected()], [1000, 1000, 1000])
})

test('مرتجع على فاتورة مدفوعة: جزء اترد كاش والباقي رصيد للعميل، والمحصّل بيقل باللي اترد', () => {
  assert.equal(err(() => returnOne(first, 1, 300)), 'REFUND_EXCEEDS', 'مينفعش يترد أكتر من اللي ليه')
  const returnId = returnOne(first, 2, 100) // رجّع بـ 500: اترد 100 كاش، و400 رصيد
  const r = returns.getReturn({ id: returnId })!
  assert.deepEqual([r.total, r.refunded, r.sale_remaining, r.sale_credit], [500, 100, 0, 400], 'المرتجع بيعرض اللي اترد وحالة الفاتورة')
  const s = sale(first)
  assert.deepEqual([s.paid, s.remaining, s.credit], [900, 0, 400])
  // الفاتورة بتعرض كل رقم لوحده: دفع 1000، اترد 100، ورصيد 400
  assert.deepEqual([s.total, s.paid + s.refunded + s.credit_used, s.refunded, s.returns_total], [1000, 1000, 100, 500])
  assert.deepEqual([customers.getStatement({ id: cust }).totals.paid, customers.getStatement({ id: cust }).totals.refunded], [1000, 100])
  assert.equal(collected(), 900)
  const statement = customers.getStatement({ id: cust })
  assert.equal(statement.totals.credit, 400)
  assert.deepEqual(statement.refunds.map((r) => [r.kind, r.amount]), [['cash', 100]])
  assert.equal(customers.listCustomers({}).find((c) => c.id === cust)!.credit, 400)
})

test('فاتورة جديدة بتتخصم من الرصيد، والكاش الافتراضي = اللي فاضل', () => {
  const second = sales.createSale({ customer_id: cust, use_credit: true, items: [{ item_id: oud, condition: 'new', quantity: 2 }] }) // 500
  const s = sale(second)
  assert.deepEqual([s.paid, s.remaining], [500, 0])
  assert.equal(sale(first).credit, 0, 'الرصيد اتخصم')
  assert.deepEqual([sale(first).credit_used, sale(first).paid + sale(first).refunded + sale(first).credit_used], [400, 1000], 'الفاتورة القديمة لسه بتقول دفع 1000')
  assert.equal(collected(), 1000, '900 + 100 كاش جديد (الـ 400 من الرصيد مش فلوس جديدة)')
  assert.deepEqual(s.payments.map((p) => [p.amount, p.from_credit]), [[400, 1], [100, 0]])

  // حذف الفاتورة الجديدة بيرجّع الرصيد
  sales.removeSale({ id: second })
  assert.equal(sale(first).credit, 400)
  assert.equal(collected(), 900)
})

test('من صفحة العميل: خصم الرصيد على فاتورة عليها فلوس', () => {
  const debt = sales.createSale({ customer_id: cust, paid: 0, items: [{ item_id: oud, condition: 'new', quantity: 1 }] }) // 250 عليه
  assert.equal(err(() => payments.collect({ customer_id: cust, amount: 300, from_credit: true })), 'PAYMENT_EXCEEDS_REMAINING')
  const [paymentId] = payments.collect({ customer_id: cust, amount: 250, from_credit: true })
  assert.deepEqual([sale(debt).remaining, sale(first).credit, collected()], [0, 150, 900])

  // حذف الدفعة اللي من الرصيد بيرجّعه
  payments.removePayment({ id: paymentId })
  assert.deepEqual([sale(debt).remaining, sale(first).credit], [250, 400])
  assert.equal(err(() => payments.collect({ customer_id: cust + 999, amount: 1, from_credit: true })), 'NO_CREDIT')
})

test('حذف المرتجع بيلغي اللي اترد معاه', () => {
  const s0 = sales.createSale({ customer_id: cust, items: [{ item_id: oud, condition: 'new', quantity: 2 }] }) // 500 مدفوعة
  const before = collected()
  const r = returnOne(s0, 1, 250)
  assert.equal(collected(), before - 250)
  returns.removeReturn({ id: r })
  assert.deepEqual([collected(), sale(s0).credit, sale(s0).paid], [before, 0, 500])
})

test('فاتورة كاش من غير عميل: الزيادة كلها بترجع كاش (مفيش حد نشيل له رصيد)', () => {
  const cash = sales.createSale({ items: [{ item_id: oud, condition: 'new', quantity: 2 }] })
  const before = collected()
  returnOne(cash, 1)
  assert.deepEqual([sale(cash).credit, sale(cash).paid, collected()], [0, 250, before - 250])
})

test('مرتجع على فاتورة لسه عليها فلوس: الباقي بيقل ومفيش رد', () => {
  const debt = sales.createSale({ customer_id: cust, paid: 100, items: [{ item_id: oud, condition: 'new', quantity: 2 }] }) // 500، دفع 100
  assert.equal(err(() => returnOne(debt, 1, 50)), 'REFUND_EXCEEDS')
  returnOne(debt, 1)
  assert.deepEqual([sale(debt).remaining, sale(debt).credit], [150, 0])
})
