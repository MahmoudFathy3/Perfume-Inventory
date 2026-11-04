import assert from 'node:assert/strict'
import test from 'node:test'
import * as categories from '../features/categories/categories.service'
import * as customers from '../features/customers/customers.service'
import { exportData } from '../features/export/export.service'
import * as items from '../features/items/items.service'
import * as purchases from '../features/purchases/purchases.service'
import * as returns from '../features/returns/returns.service'
import * as sales from '../features/sales/sales.service'
import { dateClause } from '../lib/dateRange'
import { useTestDb } from './helpers'

useTestDb()

const JAN = { from: '2026-01-01', to: '2026-01-31' }
const FEB = { from: '2026-02-01', to: '2026-02-28' }
let item = 0
let sami = 0
let hoda = 0

test('شرط الفترة: من / إلى اختياري، والفاضي من غير شرط', () => {
  assert.deepEqual(dateClause('d', {}), { where: '', params: {} })
  assert.deepEqual(dateClause('d', { from: '2026-01-01' }), { where: 'AND d >= @from', params: { from: '2026-01-01' } })
  assert.deepEqual(dateClause('d', JAN), { where: 'AND d >= @from AND d <= @to', params: JAN })
})

test('تجهيز: شراء في يناير وفبراير، وبيع لعميلين في الشهرين، ومرتجع في فبراير', () => {
  const cat = categories.createCategory({ name: 'دخوني' })
  item = items.createItem({ category_id: cat, name_ar: 'خليفه', stock: { new: { quantity: 0, purchase_price: 0, selling_price: 100, wholesale_price: 0 }, damaged: { quantity: 0, purchase_price: 0, selling_price: 0, wholesale_price: 0 } } })
  const line = (quantity: number) => ({ item_id: item, condition: 'new' as const, quantity, purchase_price: 50, selling_price: 100 })
  purchases.createPurchase({ supplier_name: 'مورد يناير', purchase_date: '2026-01-10', items: [line(10)] })
  purchases.createPurchase({ supplier_name: 'مورد فبراير', purchase_date: '2026-02-10', items: [line(10)] })

  sami = customers.createCustomer({ name: 'سامي' })
  hoda = customers.createCustomer({ name: 'هدى' })
  const sell = (customer_id: number, sale_date: string, quantity: number, paid?: number) =>
    sales.createSale({ customer_id, sale_date, paid, items: [{ item_id: item, condition: 'new', quantity }] })
  sell(sami, '2026-01-15', 2) // 200 مدفوعة
  const febSale = sell(sami, '2026-02-15', 3, 100) // 300، متبقي 200
  sell(hoda, '2026-02-20', 1) // 100
  returns.createReturn({ type: 'sale', sale_id: febSale, return_date: '2026-02-16', items: [{ item_id: item, condition: 'new', quantity: 1, unit_price: 100 }] })
})

test('المشتريات والمبيعات والمرتجعات بتتفلتر بتاريخ الفاتورة (شاملين أول وآخر يوم)', () => {
  const page = { pageSize: 100 }
  assert.deepEqual(purchases.pagePurchases({ ...page, ...JAN }).rows.map((p) => p.supplier_name), ['مورد يناير'])
  assert.equal(purchases.pagePurchases({ ...page, from: '2026-02-10', to: '2026-02-10' }).total, 1)
  assert.equal(purchases.pagePurchases(page).total, 2)

  assert.deepEqual(sales.pageSales({ ...page, ...FEB }).rows.map((s) => s.sale_date), ['2026-02-20', '2026-02-15'])
  assert.deepEqual(sales.pageSales({ ...page, to: '2026-01-31' }).rows.map((s) => s.sale_date), ['2026-01-15'])

  assert.equal(returns.pageReturns({ ...page, ...FEB }).total, 1)
  assert.equal(returns.pageReturns({ ...page, ...JAN }).total, 0)
})

test('العملاء: مع فترة الإجماليات من فواتير الفترة بس، واللي ملوش فواتير فيها مبيظهرش', () => {
  const summary = (filter: Parameters<typeof customers.pageCustomers>[0]) =>
    customers.pageCustomers({ pageSize: 100, ...filter }).rows.map((c) => [c.name, c.sales_count, c.total, c.remaining])
  assert.deepEqual(summary(JAN), [['سامي', 1, 200, 0]])
  assert.deepEqual(summary(FEB), [['سامي', 1, 300, 100], ['هدى', 1, 100, 0]]) // 300 - مرتجع 100 - مدفوع 100
  assert.deepEqual(summary({}), [['سامي', 2, 500, 100], ['هدى', 1, 100, 0]])
  assert.deepEqual(summary({ ...FEB, owing: true }), [['سامي', 1, 300, 100]])
})

test('التصدير بنفس فلتر الفترة', () => {
  assert.equal(exportData({ dataset: 'purchases', ...JAN })[0].rows.length, 1)
  assert.equal(exportData({ dataset: 'sales', ...FEB })[0].rows.length, 2)
  assert.equal(exportData({ dataset: 'returns', ...JAN })[0].rows.length, 0)
  assert.deepEqual(exportData({ dataset: 'customers', ...JAN })[0].rows.map((r) => r.name), ['سامي'])
})
