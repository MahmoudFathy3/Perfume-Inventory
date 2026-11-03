import assert from 'node:assert/strict'
import test from 'node:test'
import type { TransferInput } from '@shared/types'
import * as categories from '../features/categories/categories.service'
import * as items from '../features/items/items.service'
import * as partners from '../features/partners/partners.service'
import * as sales from '../features/sales/sales.service'
import * as transfers from '../features/transfers/transfers.service'
import * as ws from '../features/workspaces/workspaces.service'
import { PERSONAL_WORKSPACE_ID as PERSONAL, withWorkspace } from '../lib/workspace'
import { err, stockOf, useTestDb } from './helpers'

useTestDb()

const zero = { quantity: 0, purchase_price: 0, selling_price: 0, wholesale_price: 0 }
let oud = 0 // منتج في المخزون الفعلي: 20 قطعة بتكلفة 100
let musk = 0 // منتج تاني: 10 قطع بتكلفة 50
let shop = 0
let other = 0
let mahmoud = 0
let ahmed = 0

const input = (extra: Partial<TransferInput> = {}): TransferInput => ({
  from_workspace_id: PERSONAL,
  to_workspace_id: shop,
  kind: 'capital',
  partner_id: mahmoud,
  items: [{ item_id: oud, condition: 'new', quantity: 5 }],
  ...extra
})

const shopStock = (name: string) => withWorkspace(shop, () => items.listItems({}).find((i) => i.name_ar === name))
const page = (filter: Parameters<typeof transfers.pageTransfers>[0] = {}) => transfers.pageTransfers({ pageSize: 100, ...filter }).rows.map((t) => t.id)

test('تجهيز: منتجين في المخزون الفعلي وشراكتين', () => {
  const category = categories.createCategory({ name: 'عود' })
  oud = items.createItem({ category_id: category, name_ar: 'عود ملكي', stock: { new: { quantity: 20, purchase_price: 100, selling_price: 300, wholesale_price: 250 }, damaged: zero } })
  musk = items.createItem({ category_id: category, name_ar: 'مسك', stock: { new: { quantity: 10, purchase_price: 50, selling_price: 150, wholesale_price: 120 }, damaged: zero } })
  shop = ws.createWorkspace({ partners: ['محمود', 'أحمد'] })
  other = ws.createWorkspace({ partners: ['محمود', 'سيد'] })
  ;[mahmoud, ahmed] = ws.listWorkspaces().find((w) => w.id === shop)!.partners.map((p) => p.id)
})

test('تعديل التحويل: الكمية والنوع والسعر والملاحظات، والمخزن في الطرفين بيتظبط', () => {
  const id = transfers.createTransfer(input())
  assert.deepEqual([stockOf(oud, 'new').quantity, shopStock('عود ملكي')!.new_quantity], [15, 5])

  transfers.updateTransfer({
    id,
    ...input({ kind: 'sale', partner_id: ahmed, notes: 'اتعدّل', items: [{ item_id: oud, condition: 'new', quantity: 8, unit_price: 200 }] })
  })
  assert.deepEqual([stockOf(oud, 'new').quantity, stockOf(oud, 'new').purchase_price], [12, 100])
  const there = shopStock('عود ملكي')!
  assert.deepEqual([there.new_quantity, there.new_purchase_price], [8, 200], 'التكلفة في الشراكة بقت سعر التحويل الجديد')

  const t = transfers.getTransfer({ id })
  assert.deepEqual([t.kind, t.partner_id, t.notes, t.pieces, t.total_cost, t.total_price], ['sale', ahmed, 'اتعدّل', 8, 800, 1600])
  assert.equal(t.items[0].from_item_id, oud)

  withWorkspace(shop, () => {
    const a = partners.ledger().accounts
    assert.deepEqual([a[0].capital, a[1].sold], [0, 1600], 'رأس مال محمود اتشال، وأحمد بقى البائع')
  })
  transfers.removeTransfer({ id })
  assert.deepEqual([stockOf(oud, 'new').quantity, shopStock('عود ملكي')!.new_quantity], [20, 0])
})

test('تعديل المنتجات: تغيير منتج بمنتج وإضافة سطر', () => {
  const id = transfers.createTransfer(input({ kind: 'half', partner_id: null }))
  transfers.updateTransfer({
    id,
    ...input({
      kind: 'half',
      partner_id: null,
      items: [
        { item_id: musk, condition: 'new', quantity: 4 },
        { item_id: oud, condition: 'new', quantity: 1 }
      ]
    })
  })
  assert.deepEqual([stockOf(oud, 'new').quantity, stockOf(musk, 'new').quantity], [19, 6])
  assert.deepEqual([shopStock('عود ملكي')!.new_quantity, shopStock('مسك')!.new_quantity], [1, 4])
  assert.deepEqual(transfers.getTransfer({ id }).items.map((l) => [l.item_name, l.quantity]), [['مسك', 4], ['عود ملكي', 1]])
  transfers.removeTransfer({ id })
})

test('تعديل السعر بيشتغل حتى لو الشراكة باعت جزء، والكمية متقلش عن المباع', () => {
  const id = transfers.createTransfer(input({ kind: 'sale', items: [{ item_id: oud, condition: 'new', quantity: 5, unit_price: 150 }] }))
  withWorkspace(shop, () => sales.createSale({ partner_id: ahmed, items: [{ item_id: shopStock('عود ملكي')!.id, condition: 'new', quantity: 3 }] }))
  assert.equal(shopStock('عود ملكي')!.new_quantity, 2)

  transfers.updateTransfer({ id, ...input({ kind: 'sale', items: [{ item_id: oud, condition: 'new', quantity: 5, unit_price: 180 }] }) })
  assert.equal(transfers.getTransfer({ id }).total_price, 900)
  assert.deepEqual([shopStock('عود ملكي')!.new_quantity, stockOf(oud, 'new').quantity], [2, 15])

  // 3 اتباعوا: الكمية الجديدة 2 يعني لازم يرجع 3 من اللي مش موجودين
  assert.equal(err(() => transfers.updateTransfer({ id, ...input({ kind: 'sale', items: [{ item_id: oud, condition: 'new', quantity: 2 }] }) })), 'OUT_OF_STOCK')
  assert.equal(transfers.getTransfer({ id }).pieces, 5, 'الرفض مبيسيبش أثر')
  assert.equal(stockOf(oud, 'new').quantity, 15)
})

test('أخطاء التعديل: تحويل مش موجود، كمية أكبر من المتاح، شراكة مقفولة', () => {
  assert.equal(err(() => transfers.updateTransfer({ id: 9999, ...input() })), 'TRANSFER_NOT_FOUND')
  const id = transfers.createTransfer(input({ to_workspace_id: other, kind: 'half', partner_id: null, items: [{ item_id: musk, condition: 'new', quantity: 1 }] }))
  // المتاح = 10 (9 في المخزن + 1 من التحويل نفسه)
  assert.equal(err(() => transfers.updateTransfer({ id, ...input({ to_workspace_id: other, kind: 'half', partner_id: null, items: [{ item_id: musk, condition: 'new', quantity: 11 }] }) })), 'OUT_OF_STOCK')
  transfers.updateTransfer({ id, ...input({ to_workspace_id: other, kind: 'half', partner_id: null, items: [{ item_id: musk, condition: 'new', quantity: 10 }] }) })
  assert.equal(stockOf(musk, 'new').quantity, 0)

  ws.closeWorkspace({ id: other })
  assert.equal(err(() => transfers.updateTransfer({ id, ...input({ to_workspace_id: other, kind: 'half', partner_id: null }) })), 'WORKSPACE_CLOSED')
  ws.reopenWorkspace({ id: other })
})

test('فلتر التحويلات: النوع، الاتجاه، الفترة، والبحث باسم المنتج أو الشريك أو الملاحظات', () => {
  const a = transfers.createTransfer(input({ transfer_date: '2026-01-10', notes: 'دفعة أولى', items: [{ item_id: oud, condition: 'new', quantity: 1 }] }))
  const b = transfers.createTransfer(input({ kind: 'half', partner_id: null, transfer_date: '2026-02-15', items: [{ item_id: oud, condition: 'new', quantity: 1 }] }))
  const back = withWorkspace(shop, () => shopStock('عود ملكي')!.id)
  const c = transfers.createTransfer(input({ from_workspace_id: shop, to_workspace_id: PERSONAL, kind: 'half', partner_id: null, transfer_date: '2026-03-01', items: [{ item_id: back, condition: 'new', quantity: 1 }] }))

  const has = (ids: number[], expected: number[]) => assert.deepEqual(expected.map((id) => ids.includes(id)), expected.map(() => true))
  const hasNot = (ids: number[], unexpected: number[]) => assert.deepEqual(unexpected.filter((id) => ids.includes(id)), [])

  has(page({ kind: 'capital' }), [a]); hasNot(page({ kind: 'capital' }), [b, c])
  has(page({ direction: 'in' }), [c]); hasNot(page({ direction: 'in' }), [a, b])
  has(page({ direction: 'out' }), [a, b]); hasNot(page({ direction: 'out' }), [c])
  assert.deepEqual(page({ from: '2026-02-01', to: '2026-02-28' }), [b])
  assert.deepEqual(page({ search: 'دفعه اولي' }), [a], 'البحث العربي بيتجاهل الهمزة والتاء المربوطة')
  assert.ok(page({ search: 'مسك' }).length > 0)
  hasNot(page({ search: 'مسك' }), [a, b, c])
  has(page({ search: 'محمود', from: '2026-01-01', to: '2026-12-31' }), [a])
  hasNot(page({ search: 'محمود', from: '2026-01-01', to: '2026-12-31' }), [b, c])

  // جوه الشراكة: "داخل" = اللي جاي من المخزون الفعلي
  withWorkspace(shop, () => {
    has(page({ direction: 'in', from: '2026-01-01', to: '2026-12-31' }), [a, b])
    assert.deepEqual(page({ direction: 'out', from: '2026-01-01', to: '2026-12-31' }), [c])
  })
})
