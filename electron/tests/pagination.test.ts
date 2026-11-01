import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { closeDb, getDb, openDb } from '../database/connection'
import { migrate } from '../database/migrate'
import * as categories from '../features/categories/categories.service'
import * as customers from '../features/customers/customers.service'
import * as items from '../features/items/items.service'
import * as purchases from '../features/purchases/purchases.service'
import * as returns from '../features/returns/returns.service'
import * as sales from '../features/sales/sales.service'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'page-'))
let catId = 0
const zero = { quantity: 0, purchase_price: 0, selling_price: 0, wholesale_price: 0 }
const itemIds: number[] = []

test.before(() => {
  openDb(path.join(tmp, 'inventory.sqlite'))
  migrate(getDb())
  catId = categories.createCategory({ name: 'عام' })
  for (let i = 1; i <= 25; i++) {
    const name = `منتج ${String(i).padStart(2, '0')}`
    itemIds.push(items.createItem({ category_id: catId, name_ar: name, stock: { new: { quantity: 100, purchase_price: 10, selling_price: 20, wholesale_price: 15 }, damaged: zero } }))
  }
})
test.after(() => {
  closeDb()
  fs.rmSync(tmp, { recursive: true, force: true })
})

test('الـ pagination في SQL: الصفحة، الإجمالي، وعدد الصفحات', () => {
  const p1 = items.pageItems({ page: 1, pageSize: 10 })
  assert.deepEqual([p1.rows.length, p1.total, p1.page, p1.pageSize, p1.pageCount], [10, 25, 1, 10, 3])
  assert.equal(p1.rows[0].name_ar, 'منتج 01')

  const p3 = items.pageItems({ page: 3, pageSize: 10 })
  assert.deepEqual(p3.rows.map((r) => r.name_ar), ['منتج 21', 'منتج 22', 'منتج 23', 'منتج 24', 'منتج 25'])

  // الصفحات مبتتكررش وبتغطي كل الصفوف
  const all = [1, 2, 3].flatMap((page) => items.pageItems({ page, pageSize: 10 }).rows.map((r) => r.id))
  assert.deepEqual([...all].sort((a, b) => a - b), [...itemIds].sort((a, b) => a - b))
})

test('قيم غريبة: صفحة بعد الأخيرة بترجّع الأخيرة، وحجم الصفحة له حد أقصى وافتراضي', () => {
  assert.equal(items.pageItems({ page: 99, pageSize: 10 }).page, 3)
  assert.equal(items.pageItems({ page: -4, pageSize: 10 }).page, 1)
  assert.equal(items.pageItems({}).pageSize, 10)
  assert.equal(items.pageItems({ pageSize: 100000 }).pageSize, 100)
  assert.equal(items.pageItems({ page: Number.NaN, pageSize: 5 }).page, 1)
})

test('البحث بيتحسب قبل الـ pagination (الإجمالي بعد البحث)، وفاضي = صفحة واحدة', () => {
  const hit = items.pageItems({ search: 'منتج 1', pageSize: 5 }) // 10..19 = 10 منتجات
  assert.deepEqual([hit.total, hit.pageCount, hit.rows.length], [10, 2, 5])
  const none = items.pageItems({ search: 'مفيش', pageSize: 5 })
  assert.deepEqual([none.rows.length, none.total, none.page, none.pageCount], [0, 0, 1, 1])
})

test('العملاء (فيهم GROUP BY / HAVING) والأصناف والمبيعات والمشتريات والمرتجعات كلها بتتقسم', () => {
  for (let i = 1; i <= 12; i++) customers.createCustomer({ name: `عميل ${i}` })
  const c = customers.pageCustomers({ page: 2, pageSize: 5 })
  assert.deepEqual([c.rows.length, c.total, c.pageCount], [5, 12, 3])

  // عليهم فلوس بس: الإجمالي بيتحسب بعد HAVING
  const debtor = customers.pageCustomers({ search: 'عميل 1', pageSize: 100 }).rows[0].id
  sales.createSale({ customer_id: debtor, paid: 0, items: [{ item_id: itemIds[0], condition: 'new', quantity: 1 }] })
  const owing = customers.pageCustomers({ owing: true, pageSize: 5 })
  assert.deepEqual([owing.total, owing.rows.length, owing.rows[0].id], [1, 1, debtor])

  for (let i = 1; i <= 7; i++) categories.createCategory({ name: `صنف ${i}` })
  assert.deepEqual([categories.pageCategories({ pageSize: 3, page: 3 }).rows.length, categories.pageCategories({ pageSize: 3 }).total], [2, 8])

  for (let i = 1; i <= 6; i++) {
    purchases.createPurchase({ supplier_name: `مورد ${i}`, purchase_date: `2026-05-0${i}`, items: [{ item_id: itemIds[1], condition: 'new', quantity: 1, purchase_price: 10 }] })
    sales.createSale({ sale_date: `2026-05-0${i}`, items: [{ item_id: itemIds[2], condition: 'new', quantity: 1 }] })
  }
  const pp = purchases.pagePurchases({ pageSize: 4, page: 2 })
  assert.deepEqual([pp.rows.length, pp.total, pp.rows[0].supplier_name], [2, 6, 'مورد 2'])
  assert.equal(pp.rows[0].purchase_date >= pp.rows[1].purchase_date, true) // الترتيب محفوظ (الأحدث الأول)

  const ss = sales.pageSales({ pageSize: 4 })
  assert.deepEqual([ss.rows.length, ss.total], [4, 7])
  assert.ok(ss.rows.every((r) => 'remaining' in r)) // نفس بيانات القايمة الكاملة (مدفوع/متبقي)

  const cashSale = sales.listSales({}).find((r) => r.customer_id === null)! // فاتورة فيها منتج itemIds[2]
  returns.createReturn({ type: 'sale', sale_id: cashSale.id, items: [{ item_id: itemIds[2], condition: 'new', quantity: 1, unit_price: 20 }] })
  const rr = returns.pageReturns({ pageSize: 10 })
  assert.deepEqual([rr.rows.length, rr.total], [1, 1])
})
