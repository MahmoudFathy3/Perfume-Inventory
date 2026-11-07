import assert from 'node:assert/strict'
import test from 'node:test'
import { createDatabase } from '../database/connection'
import { migrate } from '../database/migrate'
import * as categories from '../features/categories/categories.service'
import * as items from '../features/items/items.service'
import * as purchases from '../features/purchases/purchases.service'
import * as returns from '../features/returns/returns.service'
import * as ws from '../features/workspaces/workspaces.service'
import { withWorkspace } from '../lib/workspace'
import { err, useTestDb } from './helpers'

useTestDb()

let item = 0
const line = (quantity: number, purchase_price = 100) => ({ item_id: item, condition: 'new' as const, quantity, purchase_price, selling_price: 200 })
const get = (id: number) => purchases.getPurchase({ id })!

test('تجهيز منتج', () => {
  const cat = categories.createCategory({ name: 'دخوني' })
  item = items.createItem({ category_id: cat, name_ar: 'خليفه', stock: { new: { quantity: 0, purchase_price: 0, selling_price: 200, wholesale_price: 0 }, damaged: { quantity: 0, purchase_price: 0, selling_price: 0, wholesale_price: 0 } } })
})

test('فاتورة شراء جديدة: من غير مدفوع = مدفوعة كلها، ومدفوع جزئي بيسيب متبقي للمورد', () => {
  const full = purchases.createPurchase({ supplier_name: 'مورد أ', items: [line(10)] })
  assert.deepEqual([get(full).paid, get(full).remaining, get(full).payments.length], [1000, 0, 1])

  const partial = purchases.createPurchase({ supplier_name: 'مورد ب', paid: 300, items: [line(10)] })
  assert.deepEqual([get(partial).paid, get(partial).remaining], [300, 700])

  const credit = purchases.createPurchase({ supplier_name: 'مورد ج', paid: 0, items: [line(5)] })
  assert.deepEqual([get(credit).paid, get(credit).remaining, get(credit).payments.length], [0, 500, 0])

  assert.equal(err(() => purchases.createPurchase({ supplier_name: 'مورد', paid: 2000, items: [line(1)] })), 'PAID_EXCEEDS_TOTAL')
})

test('دفعات بعد كده: مينفعش أكتر من المتبقي، والمتبقي بيقل بالمرتجع', () => {
  const id = purchases.pagePurchases({ pageSize: 100, search: 'مورد ب' }).rows[0].id
  purchases.payPurchase({ purchase_id: id, amount: 200, payment_date: '2026-03-01', notes: 'دفعة تانية' })
  assert.deepEqual([get(id).paid, get(id).remaining], [500, 500])
  assert.equal(err(() => purchases.payPurchase({ purchase_id: id, amount: 501 })), 'PAYMENT_EXCEEDS_REMAINING')

  // مرتجع شراء قطعتين (200) بيقلل اللي للمورد
  returns.createReturn({ type: 'purchase', purchase_id: id, items: [{ item_id: item, condition: 'new', quantity: 2, unit_price: 100 }] })
  assert.deepEqual([get(id).returns_total, get(id).remaining], [200, 300])

  purchases.payPurchase({ purchase_id: id, amount: 300 })
  assert.equal(get(id).remaining, 0)
  assert.equal(err(() => purchases.payPurchase({ purchase_id: id, amount: 1 })), 'NOTHING_DUE')

  // حذف دفعة بيرجّع المتبقي
  const last = get(id).payments.at(-1)!
  purchases.removePurchasePayment({ id: last.id })
  assert.equal(get(id).remaining, 300)
  assert.equal(err(() => purchases.removePurchasePayment({ id: last.id })), 'PAYMENT_NOT_FOUND')
})

test('التعديل: الدفعات بتفضل، والإجمالي مينفعش يقل عنها', () => {
  const id = purchases.pagePurchases({ pageSize: 100, search: 'مورد ج' }).rows[0].id
  purchases.payPurchase({ purchase_id: id, amount: 400 })
  assert.equal(err(() => purchases.updatePurchase({ id, supplier_name: 'مورد ج', items: [line(3)] })), 'TOTAL_BELOW_PAID') // 300 < 400
  purchases.updatePurchase({ id, supplier_name: 'مورد ج', items: [line(6)] })
  assert.deepEqual([get(id).total, get(id).paid, get(id).remaining], [600, 400, 200])
})

test('الشراكة: من جيب الشريك = مدفوعة كلها من غير دفعات للمورد، والتحويل بين النوعين بيظبط الدفعات', () => {
  const shop = ws.createWorkspace({ partners: ['محمود', 'أحمد'] })
  const [mahmoud] = ws.listWorkspaces().find((w) => w.id === shop)!.partners
  withWorkspace(shop, () => {
    const cat = categories.createCategory({ name: 'عود' })
    const oud = (quantity: number) => ({ name_ar: 'عود', category_id: cat, condition: 'new' as const, quantity, purchase_price: 100 })
    const id = purchases.createPurchase({ supplier_name: 'مورد', partner_id: mahmoud.id, paid_by_partner: true, paid: 0, items: [oud(4)] })
    assert.deepEqual([get(id).paid, get(id).remaining, get(id).payments.length], [400, 0, 0])
    assert.equal(err(() => purchases.payPurchase({ purchase_id: id, amount: 1 })), 'PAID_BY_PARTNER')
    // المنتج اتعمل مع الفاتورة: التعديل بيبعته برقمه
    const oudLine = { item_id: get(id).items[0].item_id, condition: 'new' as const, quantity: 4, purchase_price: 100 }

    // بقت من فلوس الشراكة: بتتسجل مدفوعة كلها زي ما كانت
    purchases.updatePurchase({ id, supplier_name: 'مورد', partner_id: mahmoud.id, paid_by_partner: false, items: [oudLine] })
    assert.deepEqual([get(id).paid, get(id).payments.length], [400, 1])
    // ورجعت من جيبه: دفعات المورد بتتمسح
    purchases.updatePurchase({ id, supplier_name: 'مورد', partner_id: mahmoud.id, paid_by_partner: true, items: [oudLine] })
    assert.deepEqual([get(id).paid, get(id).payments.length], [400, 0])
  })
})

test('الـ migration: الفواتير القديمة بتتسجل مدفوعة كلها، واللي من جيب الشريك لأ', () => {
  const db = createDatabase(':memory:')
  migrate(db)
  // نرجع خطوة: نمسح الدفعات والـ migration ونحط فواتير قديمة
  db.exec("DELETE FROM schema_migrations WHERE id = '017_purchase_payments'; DROP TABLE purchase_payments;")
  db.exec(`INSERT INTO purchases(supplier_name, purchase_date, total, paid_by_partner) VALUES ('قديم', '2025-01-01', 500, 0), ('جيب', '2025-01-02', 300, 1), ('صفر', '2025-01-03', 0, 0)`)
  migrate(db)
  assert.deepEqual(db.prepare('SELECT purchase_id, amount, payment_date FROM purchase_payments').all(), [{ purchase_id: 1, amount: 500, payment_date: '2025-01-01' }])
  db.close()
})
