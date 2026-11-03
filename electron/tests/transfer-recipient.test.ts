import assert from 'node:assert/strict'
import test from 'node:test'
import type { TransferInput } from '@shared/types'
import * as categories from '../features/categories/categories.service'
import * as customers from '../features/customers/customers.service'
import * as items from '../features/items/items.service'
import * as partners from '../features/partners/partners.service'
import * as payments from '../features/payments/payments.service'
import * as sales from '../features/sales/sales.service'
import * as transfers from '../features/transfers/transfers.service'
import * as ws from '../features/workspaces/workspaces.service'
import { PERSONAL_WORKSPACE_ID as PERSONAL, withWorkspace } from '../lib/workspace'
import { err, stockOf, useTestDb } from './helpers'

useTestDb()

const zero = { quantity: 0, purchase_price: 0, selling_price: 0, wholesale_price: 0 }
let oud = 0 // مخزن مصطفى: 20 قطعة، تكلفة 100، بيع 300
let shop = 0
let mostafa = 0
let ahmed = 0

const send = (extra: Partial<TransferInput>, quantity = 2, unit_price?: number) =>
  transfers.createTransfer({
    from_workspace_id: PERSONAL,
    to_workspace_id: shop,
    kind: 'capital',
    items: [{ item_id: oud, condition: 'new', quantity, ...(unit_price === undefined ? {} : { unit_price }) }],
    ...extra
  })
const account = (id: number) => withWorkspace(shop, () => partners.ledger().accounts.find((a) => a.partner.id === id)!)
const shopOud = () => withWorkspace(shop, () => items.listItems({}).find((i) => i.name_ar === 'عود'))

test('تجهيز: مخزن مصطفى وشراكة مصطفى وأحمد', () => {
  ws.setOwner({ name: 'مصطفى' })
  const c = categories.createCategory({ name: 'عود' })
  oud = items.createItem({ category_id: c, name_ar: 'عود', stock: { new: { quantity: 20, purchase_price: 100, selling_price: 300, wholesale_price: 250 }, damaged: zero } })
  shop = ws.createWorkspace({ partners: ['مصطفى', 'أحمد'] })
  ;[mostafa, ahmed] = ws.listWorkspaces().find((w) => w.id === shop)!.partners.map((p) => p.id)
})

test('للشراكة (بالنص): بيع بالتكلفة، والشراكة عليها التكلفة لمصطفى', () => {
  const id = send({ recipient: 'partnership' })
  const t = transfers.getTransfer({ id })
  assert.deepEqual([t.recipient, t.kind, t.partner_id, t.total_cost, t.total_price], ['partnership', 'sale', mostafa, 200, 200])
  assert.equal(account(mostafa).sold, 200)
  assert.equal(shopOud()!.new_purchase_price, 100, 'القطع دخلت الشراكة بتكلفتها')
  const shared = transfers.summarizeTransfers({}).find((r) => r.kind === 'sale')!
  assert.deepEqual([shared.partner_id, shared.partner_name], [null, null], 'في الملخص تحت "الشراكة (بالنص)"')
  // السعر بيتجاهل: للشراكة دايمًا بالتكلفة
  const priced = send({ recipient: 'partnership' }, 1, 999)
  assert.equal(transfers.getTransfer({ id: priced }).total_price, 100)
  transfers.removeTransfer({ id: priced })
})

test('لمصطفى: رأس مال أو بيع بسعر، والشريك دايمًا مصطفى', () => {
  const capital = send({ recipient: 'owner', kind: 'capital', partner_id: ahmed })
  assert.deepEqual([transfers.getTransfer({ id: capital }).partner_id, account(mostafa).capital], [mostafa, 200])
  const sale = send({ recipient: 'owner', kind: 'sale' }, 1, 280)
  assert.equal(transfers.getTransfer({ id: sale }).total_price, 280)
  assert.equal(err(() => send({ recipient: 'owner', kind: 'half' })), 'INVALID_TYPE')
})

test('لأحمد: رأس مال له بسعر القطعة، وفاتورة عليه في المخزون الفعلي بربح مصطفى', () => {
  const before = stockOf(oud, 'new').quantity
  const id = send({ recipient: 'partner', partner_id: ahmed }, 2, 300)
  const t = transfers.getTransfer({ id })
  assert.deepEqual([t.recipient, t.kind, t.partner_id, t.total_cost, t.pieces], ['partner', 'capital', ahmed, 600, 2])
  assert.ok(t.partner_sale_id)
  assert.equal(stockOf(oud, 'new').quantity, before - 2, 'القطع خرجت مرة واحدة بس')
  assert.equal(account(ahmed).capital, 600)

  const invoice = sales.getSale({ id: t.partner_sale_id! })!
  const ahmedCustomer = customers.listCustomers({}).find((c) => c.name === 'أحمد')!
  assert.deepEqual([invoice.customer_id, invoice.total, invoice.paid, invoice.items[0].purchase_price], [ahmedCustomer.id, 600, 0, 100])
  assert.equal(account(ahmed).store_account!.remaining, 600, 'أحمد عليه 600 للمخزون الفعلي')

  // الفاتورة بتتعدّل وتتحذف من التحويل بس
  assert.equal(err(() => sales.removeSale({ id: invoice.id })), 'SALE_FROM_TRANSFER')

  // تعديل السعر والكمية: الفاتورة بتتعمل من جديد
  transfers.updateTransfer({ id, from_workspace_id: PERSONAL, to_workspace_id: shop, kind: 'capital', recipient: 'partner', partner_id: ahmed, items: [{ item_id: oud, condition: 'new', quantity: 3, unit_price: 250 }] })
  const edited = transfers.getTransfer({ id })
  assert.deepEqual([edited.total_cost, stockOf(oud, 'new').quantity], [750, before - 3])
  assert.equal(sales.getSale({ id: edited.partner_sale_id! })!.total, 750)
  assert.equal(sales.getSale({ id: t.partner_sale_id! }), null, 'الفاتورة القديمة اتشالت')

  // لو أحمد دفع: التعديل والحذف بيترفضوا
  payments.collect({ sale_id: edited.partner_sale_id!, amount: 100 })
  assert.equal(err(() => transfers.removeTransfer({ id })), 'PARTNER_INVOICE_PAID')
})

test('لأحمد: الحذف بيرجّع القطع لمصطفى ويلغي الفاتورة، والتحويل لصاحب المخزون مش شريك تاني', () => {
  const before = stockOf(oud, 'new').quantity
  const id = send({ recipient: 'partner', partner_id: ahmed }, 1, 300)
  const saleId = transfers.getTransfer({ id }).partner_sale_id!
  transfers.removeTransfer({ id })
  assert.equal(stockOf(oud, 'new').quantity, before)
  assert.equal(sales.getSale({ id: saleId }), null)

  assert.equal(err(() => send({ recipient: 'partner', partner_id: mostafa })), 'PARTNER_NOT_FOUND', 'مصطفى مش "الشريك التاني"')
  assert.equal(err(() => transfers.createTransfer({ from_workspace_id: shop, to_workspace_id: PERSONAL, kind: 'half', recipient: 'partnership', items: [{ item_id: shopOud()!.id, condition: 'new', quantity: 1 }] })), 'INVALID_TRANSFER')
})
