import assert from 'node:assert/strict'
import test from 'node:test'
import type { SaleInput } from '@shared/types'
import { getDb } from '../database/connection'
import * as categories from '../features/categories/categories.service'
import * as items from '../features/items/items.service'
import * as partners from '../features/partners/partners.service'
import * as payments from '../features/payments/payments.service'
import * as returns from '../features/returns/returns.service'
import * as sales from '../features/sales/sales.service'
import * as transfers from '../features/transfers/transfers.service'
import * as ws from '../features/workspaces/workspaces.service'
import { PERSONAL_WORKSPACE_ID as PERSONAL, withWorkspace } from '../lib/workspace'
import { err, stockOf, useTestDb } from './helpers'

useTestDb()

const zero = { quantity: 0, purchase_price: 0, selling_price: 0, wholesale_price: 0 }
let oud = 0 // في المخزون الفعلي (مصطفى): 10 قطع، تكلفة 100، بيع 300
let musk = 0 // في الشراكة: 30 قطعة، تكلفة 50، بيع 150
let shop = 0
let owner = 0
let ahmed = 0

const inShop = <T>(fn: () => T) => withWorkspace(shop, fn)
/** فاتورة في الشراكة: مسك من الشراكة + عود من المخزون الفعلي */
const mixed = (extra: Partial<SaleInput> = {}, oudLine: Record<string, unknown> = {}): SaleInput => ({
  partner_id: ahmed,
  customer_id: null,
  items: [
    { item_id: musk, condition: 'new', quantity: 2, selling_price: 150 },
    { item_id: oud, condition: 'new', quantity: 1, selling_price: 300, source_workspace_id: PERSONAL, ...oudLine }
  ],
  ...extra
})
const shopOud = () => inShop(() => items.listItems({}).find((i) => i.name_ar === 'عود'))
const saleTransfers = (saleId: number) => transfers.pageTransfers({ pageSize: 100 }).rows.filter((t) => t.sale_id === saleId)
const lineProfit = (saleId: number) =>
  getDb().prepare('SELECT item_id, quantity * (selling_price - purchase_price) AS profit FROM sale_items WHERE sale_id = ? ORDER BY id').all(saleId) as { item_id: number; profit: number }[]

test('تجهيز: عود في المخزون الفعلي ومسك في الشراكة', () => {
  const c = categories.createCategory({ name: 'عطور' })
  oud = items.createItem({ category_id: c, name_ar: 'عود', stock: { new: { quantity: 10, purchase_price: 100, selling_price: 300, wholesale_price: 250 }, damaged: zero } })
  shop = ws.createWorkspace({ partners: ['مصطفى', 'أحمد'] })
  ;[owner, ahmed] = ws.listWorkspaces().find((w) => w.id === shop)!.partners.map((p) => p.id)
  inShop(() => {
    const sc = categories.createCategory({ name: 'عطور' })
    musk = items.createItem({ category_id: sc, name_ar: 'مسك', stock: { new: { quantity: 30, purchase_price: 50, selling_price: 150, wholesale_price: 120 }, damaged: zero } })
  })
})

test('من غير صاحب مخزون الفاتورة المختلطة بتترفض', () => {
  assert.equal(err(() => inShop(() => sales.createSale(mixed()))), 'OWNER_REQUIRED')
  assert.equal(stockOf(oud, 'new').quantity, 10, 'الرفض مبيسيبش أثر')
  ws.setOwner({ name: 'مصطفى' })
})

test('فاتورة واحدة: العود بيتحوّل تلقائي بسعر البيع، وربحه كله للمخزون الفعلي', () => {
  const id = inShop(() => sales.createSale(mixed()))
  assert.equal(stockOf(oud, 'new').quantity, 9)
  assert.equal(shopOud()!.new_quantity, 0, 'القطعة اتحوّلت واتباعت')
  const sale = inShop(() => sales.getSale({ id }))!
  assert.equal(sale.total, 600)
  const oudLine = sale.items.find((l) => l.source_workspace_id === PERSONAL)!
  assert.deepEqual([oudLine.source_item_id, oudLine.transfer_price, oudLine.purchase_price], [oud, 300, 300])
  assert.deepEqual(lineProfit(id).map((l) => l.profit), [200, 0], 'ربح الشراكة في العود صفر')

  const [t] = inShop(() => saleTransfers(id))
  assert.deepEqual([t.kind, t.from_workspace_id, t.partner_id, t.total_price, t.total_cost, t.paid], ['sale', PERSONAL, owner, 300, 100, 300], 'كاش = مدفوعة كلها')
  inShop(() => {
    const a = partners.ledger().accounts.find((x) => x.partner.id === owner)!
    assert.deepEqual([a.sold, a.settled], [300, 300])
  })
})

test('الدفع: التحويل بيتعلّم مدفوع لما الفاتورة تتدفع كلها بس', () => {
  const customer = inShop(() => {
    const db = getDb()
    return Number(db.prepare('INSERT INTO customers(workspace_id, name) VALUES (?, ?)').run(shop, 'عميل').lastInsertRowid)
  })
  const id = inShop(() => sales.createSale(mixed({ customer_id: customer, paid: 200 })))
  const paidOf = () => inShop(() => saleTransfers(id)[0].paid)
  assert.equal(paidOf(), 0)

  const [paymentId] = inShop(() => payments.collect({ sale_id: id, amount: 400 }))
  assert.equal(paidOf(), 300)
  inShop(() => payments.removePayment({ id: paymentId }))
  assert.equal(paidOf(), 0, 'حذف الدفعة رجّع التحويل متدفعش')
})

test('سعر تحويل مختلف: الفرق ربح للشراكة', () => {
  const id = inShop(() => sales.createSale(mixed({}, { transfer_price: 250 })))
  assert.deepEqual(lineProfit(id).map((l) => l.profit), [200, 50])
  assert.equal(inShop(() => saleTransfers(id))[0].total_price, 250)
})

test('تعديل الفاتورة بيعدّل التحويل، وحذفها بيرجّع القطع للمخزون الفعلي', () => {
  const before = stockOf(oud, 'new').quantity
  const id = inShop(() => sales.createSale(mixed()))
  inShop(() => sales.updateSale({ id, ...mixed({}, { quantity: 3 }) }))
  assert.equal(stockOf(oud, 'new').quantity, before - 3)
  assert.deepEqual(inShop(() => saleTransfers(id)).map((t) => [t.pieces, t.total_price]), [[3, 900]])

  // شيل سطر العود: التحويل بيختفي
  inShop(() => sales.updateSale({ id, partner_id: ahmed, items: [{ item_id: musk, condition: 'new', quantity: 1 }] }))
  assert.equal(stockOf(oud, 'new').quantity, before)
  assert.equal(inShop(() => saleTransfers(id)).length, 0)

  inShop(() => sales.updateSale({ id, ...mixed() }))
  inShop(() => sales.removeSale({ id }))
  assert.equal(stockOf(oud, 'new').quantity, before)
  assert.equal(stockOf(oud, 'new').purchase_price, 100, 'التكلفة رجعت زي ما هي')
  assert.equal(inShop(() => saleTransfers(id)).length, 0)
})

test('الاتجاه العكسي: فاتورة في المخزون الفعلي فيها مسك من الشراكة', () => {
  const shopMuskBefore = inShop(() => stockOf(musk, 'new').quantity)
  const id = sales.createSale({ items: [{ item_id: musk, condition: 'new', quantity: 1, selling_price: 160, source_workspace_id: shop }] })
  assert.equal(inShop(() => stockOf(musk, 'new').quantity), shopMuskBefore - 1)
  const [t] = saleTransfers(id)
  assert.deepEqual([t.from_workspace_id, t.to_workspace_id, t.partner_id, t.total_price], [shop, PERSONAL, owner, 160], 'صاحب المخزون اشترى من الشراكة')
  assert.equal(lineProfit(id)[0].profit, 0)
})

test('المرتجع: للشراكة (الافتراضي) أو للمخزون الفعلي، والتحويل بيقل', () => {
  const id = inShop(() => sales.createSale(mixed({}, { quantity: 2 })))
  const oudHere = shopOud()!.id
  const before = stockOf(oud, 'new').quantity
  const line = (extra = {}) => ({ item_id: oudHere, condition: 'new' as const, quantity: 1, unit_price: 300, ...extra })

  // للشراكة: القطعة بتدخل مخزن الشراكة، والتحويل زي ما هو
  inShop(() => returns.createReturn({ type: 'sale', sale_id: id, items: [line()] }))
  assert.equal(shopOud()!.new_quantity, 1)
  assert.equal(inShop(() => saleTransfers(id))[0].pieces, 2)

  // للمخزون الفعلي: القطعة بترجع لمصطفى، والتحويل بيقل
  const toSource = inShop(() => returns.createReturn({ type: 'sale', sale_id: id, items: [line({ to_source: true })] }))
  assert.equal(stockOf(oud, 'new').quantity, before + 1)
  assert.deepEqual(inShop(() => saleTransfers(id)).map((t) => [t.pieces, t.total_price]), [[1, 300]])
  assert.equal(err(() => inShop(() => returns.createReturn({ type: 'sale', sale_id: id, items: [line({ to_source: true })] }))), 'RETURN_EXCEEDS')

  // حذف المرتجع للمصدر: القطعة بتتسحب تاني والتحويل بيرجع
  inShop(() => returns.removeReturn({ id: toSource }))
  assert.equal(stockOf(oud, 'new').quantity, before)
  assert.deepEqual(inShop(() => saleTransfers(id)).map((t) => [t.pieces, t.total_price]), [[2, 600]])
})

test('مرتجع للمصدر لمنتج مش جاي من مخزن تاني بيترفض', () => {
  const id = inShop(() => sales.createSale({ partner_id: ahmed, items: [{ item_id: musk, condition: 'new', quantity: 1 }] }))
  assert.equal(err(() => inShop(() => returns.createReturn({ type: 'sale', sale_id: id, items: [{ item_id: musk, condition: 'new', quantity: 1, unit_price: 150, to_source: true }] }))), 'RETURN_EXCEEDS_SOURCE')
})

test('التحويل التلقائي بيتعدّل ويتدفع مع الفاتورة بس', () => {
  const id = inShop(() => sales.createSale(mixed()))
  const t = inShop(() => saleTransfers(id))[0]
  assert.equal(err(() => transfers.removeTransfer({ id: t.id })), 'TRANSFER_FROM_SALE')
  assert.equal(err(() => transfers.payTransfer({ transfer_id: t.id, amount: 1 })), 'TRANSFER_FROM_SALE')
  assert.equal(
    err(() => transfers.updateTransfer({ id: t.id, from_workspace_id: PERSONAL, to_workspace_id: shop, kind: 'half', items: [{ item_id: oud, condition: 'new', quantity: 1 }] })),
    'TRANSFER_FROM_SALE'
  )
  const payment = inShop(() => partners.ledger().payments.find((p) => p.transfer_id === t.id))!
  assert.equal(err(() => inShop(() => partners.removePayment({ id: payment.id }))), 'PAYMENT_FROM_SALE')
})
