import assert from 'node:assert/strict'
import test from 'node:test'
import * as categories from '../features/categories/categories.service'
import * as customers from '../features/customers/customers.service'
import * as items from '../features/items/items.service'
import * as purchases from '../features/purchases/purchases.service'
import { err, useTestDb } from './helpers'

useTestDb()
let catId = 0
test.before(() => {
  catId = categories.createCategory({ name: 'أدوات منزلية' })
  items.createItem({ category_id: catId, name_ar: 'كوباية زجاج', name_en: 'Glass cup' })
  customers.createCustomer({ name: 'أحمد' })
})

test('منع تكرار الأسماء: المنتجات والأصناف والعملاء', () => {
  // منتج: نفس الاسم بهمزة/تاء مختلفة، أو اسم إنجليزي موجود، أو اسم عربي مطابق لاسم إنجليزي موجود
  assert.equal(err(() => items.createItem({ category_id: catId, name_ar: 'كوبايه زجاج' })), 'DUPLICATE_NAME')
  assert.equal(err(() => items.createItem({ category_id: catId, name_ar: 'منتج مختلف', name_en: 'glass cup' })), 'DUPLICATE_NAME')
  assert.equal(err(() => items.createItem({ category_id: catId, name_ar: 'GLASS CUP' })), 'DUPLICATE_NAME')

  // التعديل: المنتج بيتعدل بنفس اسمه، لكن مينفعش ياخد اسم منتج تاني
  const other = items.createItem({ category_id: catId, name_ar: 'منتج تجربة التكرار' })
  items.updateItem({ id: other, category_id: catId, name_ar: 'منتج تجربة التكرار', name_en: 'Dup test' })
  assert.equal(err(() => items.updateItem({ id: other, category_id: catId, name_ar: 'كوباية زجاج' })), 'DUPLICATE_NAME')
  items.removeItem({ id: other })

  // فاتورة شراء بمنتج جديد باسم موجود
  const lines = [{ name_ar: 'كوباية زجاج', category_id: catId, condition: 'new' as const, quantity: 1, purchase_price: 1 }]
  assert.equal(err(() => purchases.createPurchase({ supplier_name: 'م', items: lines })), 'DUPLICATE_NAME')

  // الأصناف والعملاء
  assert.equal(err(() => categories.createCategory({ name: 'ادوات منزليه' })), 'DUPLICATE_NAME')
  const extra = categories.createCategory({ name: 'صنف للتجربة' })
  categories.updateCategory({ id: extra, name: 'صنف للتجربة' })
  assert.equal(err(() => categories.updateCategory({ id: extra, name: 'أدوات منزلية' })), 'DUPLICATE_NAME')
  categories.removeCategory({ id: extra })
  assert.equal(err(() => customers.createCustomer({ name: 'احمد' })), 'DUPLICATE_NAME')
  assert.equal(err(() => customers.createCustomer({ name: '  ' })), 'NAME_REQUIRED')
})

// ============================================================
// تعديل وحذف فواتير الشراء
// ============================================================
