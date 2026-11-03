import assert from 'node:assert/strict'
import test from 'node:test'
import type { TransferInput } from '@shared/types'
import * as categories from '../features/categories/categories.service'
import * as items from '../features/items/items.service'
import * as partners from '../features/partners/partners.service'
import * as transfers from '../features/transfers/transfers.service'
import * as ws from '../features/workspaces/workspaces.service'
import { PERSONAL_WORKSPACE_ID as PERSONAL, withWorkspace } from '../lib/workspace'
import { err, useTestDb } from './helpers'

useTestDb()

const zero = { quantity: 0, purchase_price: 0, selling_price: 0, wholesale_price: 0 }
let oud = 0
let shop = 0
let mahmoud = 0
let ahmed = 0

/** بيع من المخزون الفعلي للشراكة: 2 قطعة بـ 500 = 1000 */
const sell = (extra: Partial<TransferInput> = {}) =>
  transfers.createTransfer({
    from_workspace_id: PERSONAL,
    to_workspace_id: shop,
    kind: 'sale',
    partner_id: mahmoud,
    items: [{ item_id: oud, condition: 'new', quantity: 2, unit_price: 500 }],
    ...extra
  })

const pay = (transfer_id: number, amount: number) => transfers.payTransfer({ transfer_id, amount })
const ledgerOf = (partnerId: number) => withWorkspace(shop, () => partners.ledger().accounts.find((a) => a.partner.id === partnerId)!)

test('تجهيز: منتج في المخزون الفعلي وشراكة', () => {
  const category = categories.createCategory({ name: 'عود' })
  oud = items.createItem({ category_id: category, name_ar: 'عود', stock: { new: { quantity: 50, purchase_price: 100, selling_price: 300, wholesale_price: 250 }, damaged: zero } })
  shop = ws.createWorkspace({ partners: ['محمود', 'أحمد'] })
  ;[mahmoud, ahmed] = ws.listWorkspaces().find((w) => w.id === shop)!.partners.map((p) => p.id)
})

test('دفعة على تحويل بيع: المدفوع والمتبقي، وبتتسجل تسوية للشريك البائع', () => {
  const id = sell()
  assert.equal(transfers.getTransfer({ id }).paid, 0)
  assert.equal(err(() => pay(id, 0)), 'INVALID_AMOUNT')
  assert.equal(ledgerOf(mahmoud).balance, 1000)

  pay(id, 400)
  const t = transfers.getTransfer({ id })
  assert.deepEqual([t.paid, t.payments.length, t.payments[0].amount, t.payments[0].transfer_id], [400, 1, 400, id])
  assert.deepEqual([ledgerOf(mahmoud).settled, ledgerOf(mahmoud).balance], [400, 600], 'حسابات الشركاء اتظبطت لوحدها')

  assert.equal(err(() => pay(id, 601)), 'PAYMENT_EXCEEDS_REMAINING')
  pay(id, 600)
  assert.equal(transfers.getTransfer({ id }).paid, 1000)
  assert.equal(err(() => pay(id, 1)), 'PAYMENT_EXCEEDS_REMAINING')
})

test('بيع من الشراكة للمخزون الفعلي: الشريك المشتري هو اللي بيدفع للشراكة', () => {
  const shopOud = withWorkspace(shop, () => items.listItems({}).find((i) => i.name_ar === 'عود')!.id)
  const id = transfers.createTransfer({
    from_workspace_id: shop,
    to_workspace_id: PERSONAL,
    kind: 'sale',
    partner_id: ahmed,
    items: [{ item_id: shopOud, condition: 'new', quantity: 1, unit_price: 700 }]
  })
  pay(id, 700)
  const payment = transfers.getTransfer({ id }).payments[0]
  assert.equal(payment.amount, -700, 'سالب = الشريك دفع للشراكة')
  assert.equal(transfers.getTransfer({ id }).paid, 700)
})

test('الدفع على تحويل مش بيع بيترفض، والتحويل اللي مش موجود', () => {
  const half = transfers.createTransfer({ from_workspace_id: PERSONAL, to_workspace_id: shop, kind: 'half', items: [{ item_id: oud, condition: 'new', quantity: 1 }] })
  assert.equal(err(() => pay(half, 10)), 'NOT_A_SALE_TRANSFER')
  assert.equal(err(() => pay(9999, 10)), 'TRANSFER_NOT_FOUND')
})

test('تعديل تحويل عليه دفعات: السعر والكمية مسموح، والإجمالي متقلش عن المدفوع، والشريك والنوع ثابتين', () => {
  const id = sell()
  pay(id, 800)
  const base = { from_workspace_id: PERSONAL, to_workspace_id: shop, kind: 'sale' as const, partner_id: mahmoud }

  transfers.updateTransfer({ id, ...base, items: [{ item_id: oud, condition: 'new', quantity: 3, unit_price: 500 }] })
  assert.deepEqual([transfers.getTransfer({ id }).total_price, transfers.getTransfer({ id }).paid], [1500, 800])

  assert.equal(err(() => transfers.updateTransfer({ id, ...base, items: [{ item_id: oud, condition: 'new', quantity: 1, unit_price: 500 }] })), 'TOTAL_BELOW_PAID')
  assert.equal(err(() => transfers.updateTransfer({ id, ...base, partner_id: ahmed, items: [{ item_id: oud, condition: 'new', quantity: 3, unit_price: 500 }] })), 'TRANSFER_HAS_PAYMENTS')
  assert.equal(err(() => transfers.updateTransfer({ id, ...base, kind: 'capital', items: [{ item_id: oud, condition: 'new', quantity: 3 }] })), 'TRANSFER_HAS_PAYMENTS')
  assert.equal(transfers.getTransfer({ id }).pieces, 3, 'الرفض مبيسيبش أثر')
})

test('حذف التحويل بيحذف دفعاته، وحسابات الشريك بترجع', () => {
  const before = ledgerOf(mahmoud)
  const id = sell()
  pay(id, 300)
  transfers.removeTransfer({ id })
  const after = ledgerOf(mahmoud)
  assert.deepEqual([after.sold, after.settled], [before.sold, before.settled])
})

test('فلتر الدفع وملخص الفلوس من وجهة نظر كل مخزن', () => {
  const unpaid = transfers.pageTransfers({ pageSize: 100, payment: 'unpaid' }).rows
  const paid = transfers.pageTransfers({ pageSize: 100, payment: 'paid' }).rows
  assert.ok(unpaid.every((t) => t.kind === 'sale' && t.paid < t.total_price))
  assert.ok(paid.every((t) => t.kind === 'sale' && t.paid === t.total_price))
  assert.deepEqual([paid.length, unpaid.length], [2, 1])

  // المخزون الفعلي: باع بـ 1000 (اتدفع) + 1500 (اتدفع 800)، واشترى بـ 700 (اتدفع)
  const mine = transfers.transferMoney()
  assert.deepEqual(mine.receivable, { total: 2500, paid: 1800, remaining: 700, unpaid_count: 1 })
  assert.deepEqual(mine.payable, { total: 700, paid: 700, remaining: 0, unpaid_count: 0 })
  assert.deepEqual(mine.stores.map((s) => [s.workspace_id, s.receivable.remaining]), [[shop, 700]])
  assert.equal(mine.unpaid.length, 1)

  // الشراكة: نفس الأرقام بالعكس
  const theirs = withWorkspace(shop, () => transfers.transferMoney())
  assert.deepEqual([theirs.payable.remaining, theirs.receivable.total], [700, 700])
})
