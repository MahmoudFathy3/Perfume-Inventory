import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { closeDb, getDb, openDb } from '../database/connection'
import { migrate } from '../database/migrate'
import * as categories from '../features/categories/categories.service'
import * as customers from '../features/customers/customers.service'
import * as dashboard from '../features/dashboard/dashboard.service'
import { loadSheets } from '../features/export/datasets'
import * as items from '../features/items/items.service'
import * as purchases from '../features/purchases/purchases.service'
import * as sales from '../features/sales/sales.service'
import * as ws from '../features/workspaces/workspaces.service'
import { activeWorkspaceId, PERSONAL_WORKSPACE_ID, withWorkspace } from '../lib/workspace'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ws-'))
const dbFile = path.join(tmp, 'inventory.sqlite')

test.before(() => {
  openDb(dbFile)
  migrate(getDb())
})
test.after(() => {
  closeDb()
  fs.rmSync(tmp, { recursive: true, force: true })
})

const err = (fn: () => unknown): string | undefined => {
  try {
    fn()
  } catch (e) {
    return (e as { code?: string }).code
  }
  return undefined
}
const zero = { quantity: 0, purchase_price: 0, selling_price: 0, wholesale_price: 0 }
const stockOf = (quantity: number, price: number) => ({ new: { quantity, purchase_price: 100, selling_price: price, wholesale_price: price - 100 }, damaged: zero })

test('المخزون الفعلي موجود دايمًا وهو الافتراضي، ومينفعش يتعدّل أو يتقفل أو يتحذف', () => {
  const list = ws.listWorkspaces()
  assert.deepEqual(list.map((w) => [w.id, w.kind, w.active]), [[PERSONAL_WORKSPACE_ID, 'personal', true]])
  for (const fn of [() => ws.closeWorkspace({ id: 1 }), () => ws.removeWorkspace({ id: 1 }), () => ws.updateWorkspace({ id: 1, partners: ['أ', 'ب'] })]) {
    assert.equal(err(fn), 'PERSONAL_WORKSPACE')
  }
})

test('الشراكة: شريكين بالنص، واسم الشراكة لازم يتميّز، ومحمود يقدر يعمل أكتر من شراكة مع نفس الشخص', () => {
  assert.equal(err(() => ws.createWorkspace({ partners: ['محمود'] })), 'PARTNERS_REQUIRED')
  assert.equal(err(() => ws.createWorkspace({ partners: ['محمود', ' '] })), 'PARTNERS_REQUIRED')
  assert.equal(err(() => ws.createWorkspace({ partners: ['أحمد', 'احمد'] })), 'DUPLICATE_PARTNERS') // نفس الاسم بهمزة مختلفة

  const first = ws.createWorkspace({ partners: ['محمود', 'أحمد'] })
  assert.equal(err(() => ws.createWorkspace({ partners: ['احمد', 'محمود'] })), 'DUPLICATE_NAME') // نفس الشراكة من غير اسم يميّزها
  const second = ws.createWorkspace({ name: 'مشروع العطور', partners: ['محمود', 'أحمد'] })
  assert.notEqual(first, second)

  const w = ws.listWorkspaces().find((x) => x.id === first)!
  assert.deepEqual(w.partners.map((p) => [p.name, p.share_percent]), [['محمود', 50], ['أحمد', 50]])
  ws.updateWorkspace({ id: second, name: 'مشروع الأحذية', partners: ['محمود', 'أحمد'] })
  assert.equal(ws.listWorkspaces().find((x) => x.id === second)!.name, 'مشروع الأحذية')
  assert.equal(err(() => ws.updateWorkspace({ id: second, partners: ['محمود', 'أحمد'] })), 'DUPLICATE_NAME')
})

test('العزل: كل مخزن له أصنافه ومنتجاته وعملاءه وفواتيره، ونفس اسم المنتج مسموح في مخزن تاني', () => {
  const [, first, second] = ws.listWorkspaces().map((w) => w.id)

  // المخزون الفعلي
  const cat = categories.createCategory({ name: 'دخوني' })
  const item = items.createItem({ category_id: cat, name_ar: 'خليفه', stock: stockOf(10, 2000) })
  const cust = customers.createCustomer({ name: 'سامي' })
  sales.createSale({ customer_id: cust, items: [{ item_id: item, condition: 'new', quantity: 2, selling_price: 2000 }] })

  // شراكة 1
  ws.activateWorkspace({ id: first })
  assert.equal(activeWorkspaceId(), first)
  assert.deepEqual([categories.listCategories({}).length, items.listItems({}).length, customers.listCustomers({}).length, sales.listSales({}).length], [0, 0, 0, 0])
  const cat1 = categories.createCategory({ name: 'دخوني' }) // نفس اسم الصنف
  const item1 = items.createItem({ category_id: cat1, name_ar: 'خليفه', stock: stockOf(5, 2500) }) // نفس اسم المنتج
  assert.equal(err(() => items.createItem({ category_id: cat1, name_ar: 'خليفة', stock: stockOf(1, 1) })), 'DUPLICATE_NAME') // التكرار جوه نفس المخزن لسه ممنوع
  // في الشراكة لازم نحدد مين من الشركاء اللي اشترى
  assert.equal(err(() => purchases.createPurchase({ supplier_name: 'مورد', items: [{ item_id: item1, condition: 'new', quantity: 5, purchase_price: 100 }] })), 'PARTNER_REQUIRED')
  const buyer = ws.listWorkspaces().find((w) => w.id === first)!.partners[0].id
  const pid = purchases.createPurchase({ supplier_name: 'مورد', partner_id: buyer, items: [{ item_id: item1, condition: 'new', quantity: 5, purchase_price: 100 }] })
  assert.equal(purchases.getPurchase({ id: pid })!.partner_id, buyer)
  assert.equal(purchases.pagePurchases({ partnerId: buyer }).total, 1)

  // الأرقام منفصلة
  const shared = items.listItems({})
  assert.deepEqual(shared.map((x) => [x.name_ar, x.new_quantity, x.new_selling_price]), [['خليفه', 10, 2500]])
  assert.equal(dashboard.summary({}).sales.count, 0)
  assert.equal(dashboard.summary({}).purchases.count, 1)
  assert.deepEqual(loadSheets('items', {})[0].rows.map((r) => r.name_ar), ['خليفه'])
  assert.deepEqual(loadSheets('sales', {})[0].rows, [])

  // رجوع للمخزون الفعلي: بياناته زي ما هي (والمشتريات بتاعة الشراكة مش ظاهرة)
  ws.activateWorkspace({ id: PERSONAL_WORKSPACE_ID })
  const personal = items.listItems({})
  assert.deepEqual(personal.map((x) => [x.new_quantity, x.new_selling_price]), [[8, 2000]])
  assert.deepEqual([dashboard.summary({}).sales.count, dashboard.summary({}).purchases.count], [1, 0])
  assert.equal(loadSheets('sales', {})[0].rows.length, 1)

  // مخزن تاني فاضي تمامًا
  assert.deepEqual(withWorkspace(second, () => [items.listItems({}).length, dashboard.summary({}).counts.items]), [0, 0])
  assert.equal(activeWorkspaceId(), PERSONAL_WORKSPACE_ID) // withWorkspace بيرجّع المساحة النشطة
})

test('مفيش ربط بين المخازن: منتج أو عميل أو فاتورة من مخزن تاني بتترفض', () => {
  const [, first] = ws.listWorkspaces().map((w) => w.id)
  const personalItem = items.listItems({})[0]
  const personalCustomer = customers.listCustomers({})[0]
  const personalSale = sales.listSales({})[0]
  const personalCategory = categories.listCategories({})[0]

  ws.activateWorkspace({ id: first })
  const line = { item_id: personalItem.id, condition: 'new' as const, quantity: 1 }
  assert.ok(err(() => sales.createSale({ items: [line] })), 'منتج من مخزن تاني')
  assert.equal(err(() => sales.createSale({ customer_id: personalCustomer.id, items: [{ ...line, item_id: items.listItems({})[0].id }] })), 'CUSTOMER_NOT_FOUND')
  assert.equal(sales.getSale({ id: personalSale.id }), null)
  assert.equal(items.getItem({ id: personalItem.id }), undefined)
  categories.removeCategory({ id: personalCategory.id }) // مخزن تاني: مبيمسحش حاجة
  categories.updateCategory({ id: personalCategory.id, name: 'اتغيّر' })
  ws.activateWorkspace({ id: PERSONAL_WORKSPACE_ID })
  assert.deepEqual(categories.listCategories({}).map((c) => c.name), ['دخوني'])
})

test('التبديل بيتحفظ بعد قفل التطبيق، والشراكة المقفولة بترجع للمخزون الفعلي، وحذف الفاضية بس', () => {
  const [, first, second] = ws.listWorkspaces().map((w) => w.id)
  ws.activateWorkspace({ id: first })
  closeDb(); openDb(dbFile) // إعادة تشغيل
  assert.equal(activeWorkspaceId(), first)

  ws.closeWorkspace({ id: first }) // النشطة اتقفلت: نرجع للفعلي
  assert.equal(activeWorkspaceId(), PERSONAL_WORKSPACE_ID)
  assert.equal(err(() => ws.activateWorkspace({ id: first })), 'WORKSPACE_CLOSED')
  assert.equal(items.listItems({}).length, 1)
  ws.reopenWorkspace({ id: first })
  ws.activateWorkspace({ id: first })
  assert.equal(items.listItems({})[0].new_quantity, 10) // البيانات محفوظة

  assert.equal(err(() => ws.removeWorkspace({ id: first })), 'WORKSPACE_NOT_EMPTY')
  ws.removeWorkspace({ id: second }) // فاضية
  assert.equal(err(() => ws.activateWorkspace({ id: second })), 'WORKSPACE_NOT_FOUND')
  assert.equal(ws.listWorkspaces().length, 2)
  ws.activateWorkspace({ id: PERSONAL_WORKSPACE_ID })
})
