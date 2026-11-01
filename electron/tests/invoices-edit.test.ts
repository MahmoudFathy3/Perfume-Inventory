import assert from 'node:assert/strict'
import test from 'node:test'
import type { Condition } from '@shared/types'
import * as categories from '../features/categories/categories.service'
import * as items from '../features/items/items.service'
import * as purchases from '../features/purchases/purchases.service'
import * as returns from '../features/returns/returns.service'
import * as sales from '../features/sales/sales.service'
import { err, stockOf, useTestDb } from './helpers'

useTestDb()
let catId = 0
test.before(() => {
  catId = categories.createCategory({ name: 'أدوات منزلية' })
})
const stock = (cond: Condition, id: number) => stockOf(id, cond)

test('تعديل وحذف فاتورة شراء: المخزون ومتوسط التكلفة يتظبطوا', () => {
  const id = items.createItem({ category_id: catId, name_ar: 'منتج فاتورة الشراء' })
  const st = () => stock('new', id)
  const line = (quantity: number, price: number) => ({ item_id: id, condition: 'new' as const, quantity, purchase_price: price })

  const pid = purchases.createPurchase({ supplier_name: 'مورد 1', items: [{ ...line(10, 100), selling_price: 150, wholesale_price: 130 }] })
  assert.deepEqual([st().quantity, st().purchase_price, st().selling_price], [10, 100, 150])

  // تعديل: كمية 15 بسعر 120 (متوسط التكلفة بيتحسب صح) وبيانات الفاتورة بتتغير
  purchases.updatePurchase({ id: pid, supplier_name: 'مورد 2', purchase_date: '2026-02-01', notes: 'معدلة', items: [{ ...line(15, 120), selling_price: 999 }] })
  assert.deepEqual([st().quantity, st().purchase_price], [15, 120])
  assert.equal(st().selling_price, 150) // سعر البيع الحالي للمنتج مبيتغيرش من التعديل
  const edited = purchases.getPurchase({ id: pid })!
  assert.deepEqual([edited.supplier_name, edited.purchase_date, edited.notes, edited.total, edited.items.length], ['مورد 2', '2026-02-01', 'معدلة', 1800, 1])

  // اتباع جزء من الكمية: التعديل لأقل من المباع بيترفض ومفيش حاجة بتتغير
  const sid = sales.createSale({ items: [{ item_id: id, condition: 'new', quantity: 12 }] })
  assert.equal(st().quantity, 3)
  assert.equal(err(() => purchases.updatePurchase({ id: pid, supplier_name: 'م', items: [line(10, 120)] })), 'OUT_OF_STOCK')
  assert.equal(st().quantity, 3)
  assert.equal(purchases.getPurchase({ id: pid })!.items[0].quantity, 15)

  // تعديل مقبول + منتج جديد جوه التعديل (بياخد أسعاره من الفاتورة)
  purchases.updatePurchase({
    id: pid, supplier_name: 'مورد 2', shipping_cost: 0,
    items: [line(12, 120), { name_ar: 'منتج جديد داخل التعديل', category_id: catId, condition: 'new', quantity: 5, purchase_price: 10, selling_price: 25, wholesale_price: 20 }]
  })
  assert.equal(st().quantity, 0)
  const created = items.listItems({ search: 'جديد داخل' })[0]
  assert.deepEqual([created.new_quantity, created.new_selling_price, created.new_wholesale_price], [5, 25, 20])

  // الحذف بيترفض لأن الكمية اتباعت، وبعد حذف فاتورة البيع بيتنفذ
  assert.equal(err(() => purchases.removePurchase({ id: pid })), 'OUT_OF_STOCK')
  sales.removeSale({ id: sid })
  assert.equal(st().quantity, 12)

  // مرتجع على الفاتورة بيمنع التعديل والحذف لحد ما يتحذف
  const rid = returns.createReturn({ type: 'purchase', purchase_id: pid, items: [{ item_id: id, condition: 'new', quantity: 1, unit_price: 120 }] })
  assert.equal(st().quantity, 11)
  assert.equal(err(() => purchases.updatePurchase({ id: pid, supplier_name: 'م', items: [line(12, 120)] })), 'HAS_RETURNS')
  assert.equal(err(() => purchases.removePurchase({ id: pid })), 'HAS_RETURNS')
  returns.removeReturn({ id: rid })
  assert.equal(st().quantity, 12)

  purchases.removePurchase({ id: pid })
  assert.equal(st().quantity, 0)
  assert.equal(items.getItem({ id: created.id })!.new_quantity, 0)
  assert.equal(purchases.getPurchase({ id: pid }), null)
  assert.equal(err(() => purchases.removePurchase({ id: pid })), 'PURCHASE_NOT_FOUND')
})

// ============================================================
// تعديل وحذف فواتير البيع
// ============================================================
test('تعديل وحذف فاتورة بيع: الكميات بترجع للمخزن بتكلفتها', () => {
  const id = items.createItem({
    category_id: catId, name_ar: 'منتج فاتورة البيع',
    stock: { new: { quantity: 20, purchase_price: 50, selling_price: 100, wholesale_price: 0 }, damaged: { quantity: 0, purchase_price: 0, selling_price: 0, wholesale_price: 0 } }
  })
  const st = () => stock('new', id)
  const sid = sales.createSale({ items: [{ item_id: id, condition: 'new', quantity: 5, selling_price: 100 }] })
  assert.equal(st().quantity, 15)

  // تعديل: كمية 8 بسعر 110 وشحن 20 على العميل => 880 + 20
  sales.updateSale({ id: sid, shipping_cost: 20, notes: 'معدلة', items: [{ item_id: id, condition: 'new', quantity: 8, selling_price: 110 }] })
  const edited = sales.getSale({ id: sid })!
  assert.deepEqual([edited.total, edited.notes, edited.items.length, edited.items[0].purchase_price], [900, 'معدلة', 1, 50])
  assert.deepEqual([st().quantity, st().purchase_price], [12, 50])

  // فاتورة كاش (من غير عميل): بتفضل مدفوعة بالكامل بعد التعديل لأعلى أو لأقل
  assert.deepEqual([edited.paid, edited.remaining], [900, 0])
  sales.updateSale({ id: sid, items: [{ item_id: id, condition: 'new', quantity: 2, selling_price: 100 }] })
  const lower = sales.getSale({ id: sid })!
  assert.deepEqual([lower.paid, lower.remaining, lower.payments.length], [200, 0, 1])
  sales.updateSale({ id: sid, shipping_cost: 20, notes: 'معدلة', items: [{ item_id: id, condition: 'new', quantity: 8, selling_price: 110 }] })

  // أكتر من المتاح بيترفض والمخزن مبيتغيرش
  assert.equal(err(() => sales.updateSale({ id: sid, items: [{ item_id: id, condition: 'new', quantity: 30 }] })), 'OUT_OF_STOCK')
  assert.equal(st().quantity, 12)
  assert.equal(sales.getSale({ id: sid })!.items[0].quantity, 8)

  sales.removeSale({ id: sid })
  assert.equal(st().quantity, 20)
  assert.equal(sales.getSale({ id: sid }), null)
  assert.equal(err(() => sales.removeSale({ id: sid })), 'SALE_NOT_FOUND')
  assert.equal(err(() => sales.updateSale({ id: 99999, items: [{ item_id: id, condition: 'new', quantity: 1 }] })), 'SALE_NOT_FOUND')
})

// ============================================================
// الدفع الجزئي والعملاء والتحصيل
// ============================================================
