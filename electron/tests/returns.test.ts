import assert from 'node:assert/strict'
import test from 'node:test'
import type { Condition } from '@shared/types'
import * as categories from '../features/categories/categories.service'
import * as items from '../features/items/items.service'
import * as returns from '../features/returns/returns.service'
import * as sales from '../features/sales/sales.service'
import { err, stockOf, useTestDb } from './helpers'

useTestDb()
let catId = 0
test.before(() => {
  catId = categories.createCategory({ name: 'أدوات منزلية' })
})
const stock = (cond: Condition, id: number) => stockOf(id, cond)

test('حذف مرتجع: بيعكس تأثيره على المخزن ويترفض لو القطع اتباعت', () => {
  const id = items.createItem({
    category_id: catId, name_ar: 'منتج المرتجعات',
    stock: { new: { quantity: 10, purchase_price: 50, selling_price: 100, wholesale_price: 0 }, damaged: { quantity: 0, purchase_price: 0, selling_price: 0, wholesale_price: 0 } }
  })
  const st = () => stock('new', id)
  const sid = sales.createSale({ items: [{ item_id: id, condition: 'new', quantity: 4 }] })
  const rid = returns.createReturn({ type: 'sale', sale_id: sid, items: [{ item_id: id, condition: 'new', quantity: 2, unit_price: 100 }] })
  assert.equal(st().quantity, 8)
  returns.removeReturn({ id: rid })
  assert.deepEqual([st().quantity, st().purchase_price], [6, 50])

  // مرتجع بيع رجّع قطع واتباعت تاني => مينفعش يتحذف
  const rid2 = returns.createReturn({ type: 'sale', sale_id: sid, items: [{ item_id: id, condition: 'new', quantity: 2, unit_price: 100 }] })
  sales.createSale({ items: [{ item_id: id, condition: 'new', quantity: 8 }] })
  assert.equal(st().quantity, 0)
  assert.equal(err(() => returns.removeReturn({ id: rid2 })), 'OUT_OF_STOCK')
  assert.equal(err(() => returns.removeReturn({ id: 99999 })), 'RETURN_NOT_FOUND')
})

// ============================================================
// التصدير: العملاء والمدفوع
// ============================================================
