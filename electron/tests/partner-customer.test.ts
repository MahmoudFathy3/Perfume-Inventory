import assert from 'node:assert/strict'
import test from 'node:test'
import * as categories from '../features/categories/categories.service'
import * as customers from '../features/customers/customers.service'
import * as items from '../features/items/items.service'
import * as partners from '../features/partners/partners.service'
import * as sales from '../features/sales/sales.service'
import * as ws from '../features/workspaces/workspaces.service'
import { withWorkspace } from '../lib/workspace'
import { useTestDb } from './helpers'

useTestDb()

const zero = { quantity: 0, purchase_price: 0, selling_price: 0, wholesale_price: 0 }
const partnersOf = (id: number) => ws.listWorkspaces().find((w) => w.id === id)!.partners
const accounts = (id: number) => withWorkspace(id, () => partners.ledger().accounts)

test('من غير صاحب مخزون: مفيش ربط (مش عارفين مين الشريك التاني)', () => {
  const id = ws.createWorkspace({ partners: ['مصطفى', 'أحمد'] })
  assert.deepEqual(partnersOf(id).map((p) => p.customer_id), [null, null])
  assert.equal(customers.listCustomers({}).length, 0)
})

test('تحديد صاحب المخزون بيربط شركاء الشراكات القديمة بعملاء في المخزون الفعلي', () => {
  ws.setOwner({ name: 'مصطفى' })
  const [owner, ahmed] = partnersOf(ws.listWorkspaces().find((w) => w.kind === 'partnership')!.id)
  assert.equal(owner.customer_id, null, 'صاحب المخزون ملوش عميل')
  assert.ok(ahmed.customer_id)
  assert.deepEqual(customers.listCustomers({}).map((c) => c.name), ['أحمد'])
})

test('شراكة جديدة: الشريك بيتربط بعميل موجود بنفس الاسم بدل ما يتعمل عميل مكرر', () => {
  const existing = customers.createCustomer({ name: 'سيد' })
  const id = ws.createWorkspace({ partners: ['مصطفي', 'سيد'] }) // "مصطفي" = نفس صاحب المخزون (الياء والألف المقصورة واحد)
  assert.equal(partnersOf(id)[1].customer_id, existing)
  // نفس الشخص في شراكتين = نفس العميل
  const second = ws.createWorkspace({ name: 'مشروع تاني', partners: ['مصطفى', 'سيد'] })
  assert.equal(partnersOf(second)[1].customer_id, existing)
})

test('اللي الشريك بياخده لنفسه = فاتورة بيع على عميله، وبيظهر في حسابات الشركاء', () => {
  const shop = ws.listWorkspaces().find((w) => w.partners.some((p) => p.name === 'أحمد'))!.id
  const ahmed = partnersOf(shop)[1]
  const category = categories.createCategory({ name: 'عود' })
  const oud = items.createItem({ category_id: category, name_ar: 'عود', stock: { new: { quantity: 5, purchase_price: 100, selling_price: 300, wholesale_price: 250 }, damaged: zero } })
  sales.createSale({ customer_id: ahmed.customer_id!, paid: 100, items: [{ item_id: oud, condition: 'new', quantity: 2 }] })

  const [ownerAccount, ahmedAccount] = accounts(shop)
  assert.equal(ownerAccount.store_account, null)
  assert.deepEqual(ahmedAccount.store_account, { customer_id: ahmed.customer_id, sales_count: 1, total: 600, paid: 100, remaining: 500 })
})

test('تعديل اسم الشريك بيغيّر اسم عميله، والعميل المربوط مبيتحذفش', () => {
  const shop = ws.listWorkspaces().find((w) => w.partners.some((p) => p.name === 'أحمد'))!.id
  const customerId = partnersOf(shop)[1].customer_id!
  ws.updateWorkspace({ id: shop, partners: ['مصطفى', 'أحمد علي'] })
  assert.equal(customers.listCustomers({}).find((c) => c.id === customerId)!.name, 'أحمد علي')
  assert.equal(partnersOf(shop)[1].customer_id, customerId)
})
