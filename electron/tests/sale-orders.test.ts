import assert from 'node:assert/strict'
import test from 'node:test'
import type { SaleInput } from '@shared/types'
import * as categories from '../features/categories/categories.service'
import * as customers from '../features/customers/customers.service'
import * as dashboard from '../features/dashboard/dashboard.service'
import * as items from '../features/items/items.service'
import * as orders from '../features/saleOrders/saleOrders.service'
import * as sales from '../features/sales/sales.service'
import * as ws from '../features/workspaces/workspaces.service'
import { PERSONAL_WORKSPACE_ID as PERSONAL, withWorkspace } from '../lib/workspace'
import { err, stockOf, useTestDb } from './helpers'

useTestDb()

const zero = { quantity: 0, purchase_price: 0, selling_price: 0, wholesale_price: 0 }
let oud = 0
let ali = 0
let orderId = 0

const input = (extra: Partial<SaleInput> = {}): SaleInput => ({
  customer_id: ali,
  sale_date: '2025-07-01',
  items: [{ item_id: oud, condition: 'new', quantity: 3, selling_price: 300 }],
  ...extra
})
const itemOf = (id: number) => items.listItems({}).find((i) => i.id === id)!

test('تحت التجهيز: مبيتخصمش ومش داخل في المبيعات ولا حساب العميل، والقطع بتظهر محجوزة', () => {
  const c = categories.createCategory({ name: 'عطور' })
  oud = items.createItem({ category_id: c, name_ar: 'عود', stock: { new: { quantity: 10, purchase_price: 100, selling_price: 300, wholesale_price: 250 }, damaged: zero } })
  ali = customers.createCustomer({ name: 'علي' })
  const before = dashboard.summary()

  orderId = orders.createOrder(input({ paid: 200 })) // عربون 200
  const o = orders.getOrder({ id: orderId })
  assert.deepEqual([o.total, o.deposit, o.customer_name, o.pieces, o.items[0].selling_price], [900, 200, 'علي', 3, 300])

  assert.equal(stockOf(oud, 'new').quantity, 10, 'مبيتخصمش')
  assert.deepEqual([itemOf(oud).new_reserved, itemOf(oud).damaged_reserved], [3, 0], 'محجوز')
  const after = dashboard.summary()
  assert.deepEqual([after.sales.count, after.profit, after.receivables], [before.sales.count, before.profit, before.receivables])
  assert.equal(customers.listCustomers({}).find((x) => x.id === ali)!.remaining, 0, 'مش على العميل')
  assert.equal(orders.countOrders(), 1)

  assert.equal(err(() => orders.createOrder(input({ paid: 5000 }))), 'PAID_EXCEEDS_TOTAL')
  assert.equal(err(() => orders.createOrder(input({ items: [] }))), 'NO_LINES')
  // من غير سعر بياخد سعر المنتج (جملة)
  const wholesale = orders.createOrder(input({ price_type: 'wholesale', items: [{ item_id: oud, condition: 'new', quantity: 1 }] }))
  assert.equal(orders.getOrder({ id: wholesale }).total, 250)
  orders.removeOrder({ id: wholesale })
  assert.equal(itemOf(oud).new_reserved, 3, 'الإلغاء بيشيل الحجز')
})

test('تعديل الطلب، و"اتباعت" بيعمل فاتورة بيع عادية (القطع بتتخصم والعربون دفعة منها) والطلب بيتمسح', () => {
  orders.updateOrder({ id: orderId, ...input({ paid: 300, items: [{ item_id: oud, condition: 'new', quantity: 2, selling_price: 300 }] }) })
  assert.deepEqual([orders.getOrder({ id: orderId }).total, itemOf(oud).new_reserved], [600, 2])

  assert.equal(err(() => orders.confirmOrder({ id: orderId, paid: 1000 })), 'PAID_EXCEEDS_TOTAL')
  const saleId = orders.confirmOrder({ id: orderId, sale_date: '2025-07-05', paid: 100 }) // 300 عربون + 100، والباقي 200 على علي
  const sale = sales.getSale({ id: saleId })!
  assert.deepEqual([sale.total, sale.sale_date, sale.customer_id, sale.remaining], [600, '2025-07-05', ali, 200])
  assert.equal(stockOf(oud, 'new').quantity, 8, 'اتخصمت دلوقتي')
  assert.equal(itemOf(oud).new_reserved, 0)
  assert.equal(err(() => orders.getOrder({ id: orderId })), 'ORDER_NOT_FOUND', 'الطلب اتمسح')
})

test('"اتباعت" بيترفض لو القطع مش كفاية أو مش مدفوعة كلها من غير عميل، ومبيسيبش أثر', () => {
  const big = orders.createOrder(input({ items: [{ item_id: oud, condition: 'new', quantity: 50, selling_price: 300 }] }))
  assert.equal(err(() => orders.confirmOrder({ id: big })), 'OUT_OF_STOCK')
  assert.ok(orders.getOrder({ id: big }), 'الطلب لسه موجود')
  orders.removeOrder({ id: big })

  const cash = orders.createOrder(input({ customer_id: null }))
  assert.equal(err(() => orders.confirmOrder({ id: cash, paid: 0 })), 'CUSTOMER_REQUIRED')
  assert.ok(orders.confirmOrder({ id: cash }) > 0, 'مدفوعة كلها: تمام')
  assert.equal(stockOf(oud, 'new').quantity, 5)
})

test('كل مخزن طلباته، والقطعة من مخزن تاني بتتحجز في مخزنها وبتتحوّل لما الطلب يتباع', () => {
  const shop = ws.createWorkspace({ partners: ['مصطفى', 'أحمد'] })
  const [, ahmed] = ws.listWorkspaces().find((w) => w.id === shop)!.partners.map((p) => p.id)
  ws.setOwner({ name: 'مصطفى' })
  withWorkspace(shop, () => {
    assert.equal(orders.countOrders(), 0)
    const id = orders.createOrder({ partner_id: ahmed, items: [{ item_id: oud, condition: 'new', quantity: 1, selling_price: 300, source_workspace_id: PERSONAL }] })
    assert.equal(err(() => orders.createOrder({ items: [{ item_id: oud, condition: 'new', quantity: 1, selling_price: 300 }] })), 'PARTNER_REQUIRED')
    assert.equal(withWorkspace(PERSONAL, () => itemOf(oud).new_reserved), 1, 'محجوزة في المخزون الفعلي')
    orders.confirmOrder({ id })
  })
  assert.equal(stockOf(oud, 'new').quantity, 4, 'اتحوّلت واتباعت')
  assert.equal(itemOf(oud).new_reserved, 0)
})

test('رجوع فاتورة بيع لتحت التجهيز: القطع بترجع، والفاتورة بتطلع من المبيعات، واللي اتدفع بيبقى عربون', async () => {
  const returns = await import('../features/returns/returns.service')
  const stockBefore = stockOf(oud, 'new').quantity
  const saleId = sales.createSale(input({ sale_date: '2025-07-10', paid: 250, items: [{ item_id: oud, condition: 'new', quantity: 2, selling_price: 300 }] }))
  assert.equal(stockOf(oud, 'new').quantity, stockBefore - 2)
  const salesBefore = dashboard.summary().sales.count

  const orderId = orders.saleToOrder({ id: saleId })
  const o = orders.getOrder({ id: orderId })
  assert.deepEqual([o.total, o.deposit, o.customer_id, o.order_date, o.items[0].quantity], [600, 250, ali, '2025-07-10', 2])
  assert.equal(stockOf(oud, 'new').quantity, stockBefore, 'القطع رجعت')
  assert.equal(itemOf(oud).new_reserved, 2, 'ومحجوزة')
  assert.equal(dashboard.summary().sales.count, salesBefore - 1, 'الفاتورة طلعت من المبيعات')
  assert.equal(sales.getSale({ id: saleId }), null)

  // وترجع تتباع تاني عادي
  assert.ok(orders.confirmOrder({ id: orderId }) > 0)

  // فاتورة عليها مرتجع مترجعش
  const withReturn = sales.createSale(input({ customer_id: null, items: [{ item_id: oud, condition: 'new', quantity: 1, selling_price: 300 }] }))
  returns.createReturn({ type: 'sale', sale_id: withReturn, items: [{ item_id: oud, condition: 'new', quantity: 1, unit_price: 300 }] })
  assert.equal(err(() => orders.saleToOrder({ id: withReturn })), 'HAS_RETURNS')
  assert.equal(err(() => orders.saleToOrder({ id: 99999 })), 'SALE_NOT_FOUND')
})

test('أماكن المحجوز: فلتر المنتجات المحجوزة، وملخص المحجوز، والطلبات الحاجزة منتج', () => {
  const c = categories.createCategory({ name: 'زيوت' })
  const musk = items.createItem({ category_id: c, name_ar: 'مسك أبيض', stock: { new: { quantity: 10, purchase_price: 50, selling_price: 150, wholesale_price: 0 }, damaged: zero } })
  const id1 = orders.createOrder(input({ items: [{ item_id: musk, condition: 'new', quantity: 2, selling_price: 150 }] }))
  const id2 = orders.createOrder(input({ customer_id: null, items: [{ item_id: musk, condition: 'new', quantity: 1, selling_price: 140 }, { item_id: oud, condition: 'new', quantity: 1, selling_price: 300 }] }))

  const reservedOnly = items.pageItems({ reserved: true, page: 1, pageSize: 50 }).rows.map((i) => i.name_ar).sort()
  assert.deepEqual(reservedOnly, ['عود', 'مسك أبيض'].sort())
  assert.ok(items.pageItems({ page: 1, pageSize: 50 }).rows.length >= reservedOnly.length)

  assert.deepEqual(orders.reservedSummary(), { pieces: 4, value: 740, items: 2, orders: 2 })
  assert.deepEqual(orders.ordersForItem({ item_id: musk }).map((o) => [o.order_id, o.customer_name, o.quantity]), [[id1, 'علي', 2], [id2, null, 1]])

  orders.removeOrder({ id: id1 })
  orders.removeOrder({ id: id2 })
  assert.deepEqual(orders.reservedSummary(), { pieces: 0, value: 0, items: 0, orders: 0 })
  assert.equal(items.pageItems({ reserved: true, page: 1, pageSize: 50 }).rows.length, 0)
})
