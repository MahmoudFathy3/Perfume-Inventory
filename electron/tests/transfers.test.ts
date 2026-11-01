import assert from 'node:assert/strict'
import test from 'node:test'
import type { TransferInput } from '@shared/types'
import * as categories from '../features/categories/categories.service'
import { exportData } from '../features/export/export.service'
import * as items from '../features/items/items.service'
import * as partners from '../features/partners/partners.service'
import * as sales from '../features/sales/sales.service'
import * as transfers from '../features/transfers/transfers.service'
import * as ws from '../features/workspaces/workspaces.service'
import { PERSONAL_WORKSPACE_ID as PERSONAL, withWorkspace } from '../lib/workspace'
import { err, one, stockOf, useTestDb } from './helpers'

useTestDb()

const zero = { quantity: 0, purchase_price: 0, selling_price: 0, wholesale_price: 0 }
let personalItem = 0
let shop = 0 // الشراكة
let other = 0 // شراكة تانية
let mahmoud = 0
let ahmed = 0

const move = (from: number, to: number, kind: TransferInput['kind'], quantity: number, extra: Partial<TransferInput> = {}, itemId = personalItem) =>
  transfers.createTransfer({ from_workspace_id: from, to_workspace_id: to, kind, items: [{ item_id: itemId, condition: 'new', quantity }], ...extra })

/** منتج "خليفه" في الشراكة */
const shopItem = () => withWorkspace(shop, () => items.listItems({}).find((i) => i.name_ar === 'خليفه')!)

test('تجهيز: منتج في المخزون الفعلي (10 قطع بتكلفة 500) وشراكتين', () => {
  const category = categories.createCategory({ name: 'دخوني' })
  personalItem = items.createItem({
    category_id: category,
    name_ar: 'خليفه',
    stock: { new: { quantity: 10, purchase_price: 500, selling_price: 2000, wholesale_price: 1700 }, damaged: zero }
  })
  shop = ws.createWorkspace({ partners: ['محمود', 'أحمد'] })
  other = ws.createWorkspace({ partners: ['محمود', 'سيد'] })
  ;[mahmoud, ahmed] = ws.listWorkspaces().find((w) => w.id === shop)!.partners.map((p) => p.id)
})

test('رأس مال: القطع بتتنقل بتكلفتها، والمنتج والصنف بيتعملوا في الشراكة بأسعاره', () => {
  const id = move(PERSONAL, shop, 'capital', 4, { partner_id: mahmoud })
  assert.equal(stockOf(personalItem, 'new').quantity, 6)

  const item = shopItem()
  assert.equal(item.category_name, 'دخوني')
  assert.deepEqual([item.new_quantity, item.new_purchase_price, item.new_selling_price, item.new_wholesale_price], [4, 500, 2000, 1700])

  const t = transfers.getTransfer({ id })
  assert.deepEqual([t.total_cost, t.total_price, t.pieces], [2000, 2000, 4])
  assert.deepEqual(t.items.map((l) => [l.item_name, l.quantity, l.unit_cost, l.unit_price]), [['خليفه', 4, 500, 500]])
})

test('بالنص: نقل من غير شريك ولا حسابات', () => {
  move(PERSONAL, shop, 'half', 2)
  assert.equal(shopItem().new_quantity, 6)
})

test('بيع للشراكة بسعر محدد: تكلفة الشراكة بتبقى السعر وبتدخل في المتوسط، والمبلغ مستحق للشريك', () => {
  move(PERSONAL, shop, 'sale', 2, { partner_id: mahmoud, items: [{ item_id: personalItem, condition: 'new', quantity: 2, unit_price: 700 }] })
  const item = shopItem()
  assert.equal(item.new_quantity, 8)
  assert.equal(item.new_purchase_price, 550) // (6×500 + 2×700) ÷ 8
  assert.equal(stockOf(personalItem, 'new').quantity, 2)

  withWorkspace(shop, () => {
    const a = partners.ledger().accounts
    assert.deepEqual([a[0].capital, a[0].sold, a[0].balance], [2000, 1400, 1400])
    assert.deepEqual([a[1].capital, a[1].sold, a[1].balance], [0, 0, 0])
  })
})

test('الأخطاء: كمية أكبر من المتاح، شريك ناقص أو غريب، اتجاه غلط، شراكة مقفولة', () => {
  assert.equal(err(() => move(PERSONAL, shop, 'half', 99)), 'OUT_OF_STOCK')
  assert.equal(err(() => move(PERSONAL, shop, 'capital', 1)), 'PARTNER_REQUIRED')
  assert.equal(err(() => move(PERSONAL, shop, 'capital', 1, { partner_id: 99999 })), 'PARTNER_NOT_FOUND')
  assert.equal(err(() => move(PERSONAL, PERSONAL, 'half', 1)), 'INVALID_TRANSFER')
  assert.equal(err(() => move(shop, other, 'half', 1)), 'INVALID_TRANSFER')
  assert.equal(err(() => transfers.createTransfer({ from_workspace_id: PERSONAL, to_workspace_id: shop, kind: 'half', items: [] })), 'NO_LINES')
  assert.equal(err(() => move(PERSONAL, 999, 'half', 1)), 'WORKSPACE_NOT_FOUND')
  assert.equal(stockOf(personalItem, 'new').quantity, 2, 'الأخطاء متسيبش أثر')

  ws.closeWorkspace({ id: other })
  assert.equal(err(() => move(PERSONAL, other, 'half', 1)), 'WORKSPACE_CLOSED')
  ws.reopenWorkspace({ id: other })
})

test('الاتجاه العكسي: الشراكة بتبيع للمخزون الفعلي، والمنتج بيتطابق بالاسم', () => {
  const id = move(shop, PERSONAL, 'sale', 3, { partner_id: ahmed, items: [{ item_id: shopItem().id, condition: 'new', quantity: 3, unit_price: 800 }] }, shopItem().id)
  assert.equal(shopItem().new_quantity, 5)
  const mine = stockOf(personalItem, 'new')
  assert.deepEqual([mine.quantity, mine.purchase_price], [5, 680]) // (2×500 + 3×800) ÷ 5
  assert.equal(items.listItems({}).filter((i) => i.name_ar === 'خليفه').length, 1, 'مفيش منتج مكرر')

  withWorkspace(shop, () => assert.equal(partners.ledger().accounts[1].sold, -2400)) // أحمد اشترى من الشراكة

  // الحذف بيعكس كل حاجة
  transfers.removeTransfer({ id })
  assert.equal(shopItem().new_quantity, 8)
  assert.equal(shopItem().new_purchase_price, 550)
  const back = stockOf(personalItem, 'new')
  assert.deepEqual([back.quantity, back.purchase_price], [2, 500])
  assert.equal(err(() => transfers.getTransfer({ id })), 'TRANSFER_NOT_FOUND')
})

test('مينفعش تحذف تحويل لو الشراكة باعت القطع', () => {
  const capital = transfers.pageTransfers({ pageSize: 100 }) // المخزون الفعلي طرف في الكل
  const first = capital.rows.find((t) => t.kind === 'capital')!
  withWorkspace(shop, () => {
    const line = { item_id: shopItem().id, condition: 'new' as const, quantity: 7 }
    // في الشراكة لازم نحدد مين من الشركاء اللي باع، ومن نفس الشراكة
    assert.equal(err(() => sales.createSale({ items: [line] })), 'PARTNER_REQUIRED')
    const sayed = ws.listWorkspaces().find((w) => w.id === other)!.partners[1].id
    assert.equal(err(() => sales.createSale({ partner_id: sayed, items: [line] })), 'PARTNER_NOT_FOUND')
    sales.createSale({ partner_id: ahmed, items: [line] })
  })
  assert.equal(err(() => transfers.removeTransfer({ id: first.id })), 'OUT_OF_STOCK')
  assert.equal(one<{ n: number }>('SELECT COUNT(*) n FROM transfers WHERE id = ?', first.id).n, 1)
  assert.equal(shopItem().new_quantity, 1)
})

test('حسابات الشركاء: نصيب الربح + المباع - التسويات، ورأس المال لوحده', () => {
  withWorkspace(shop, () => {
    // 7 قطع × (2000 - 550) = 10150 ربح، لكل شريك 5075
    const l = partners.ledger()
    assert.equal(l.profit, 10150)
    assert.deepEqual(l.accounts.map((a) => [a.capital, a.sold, a.profit_share, a.balance]), [[2000, 1400, 5075, 6475], [0, 0, 5075, 5075]])

    partners.addPayment({ partner_id: mahmoud, amount: 1000, direction: 'to_partner' })
    partners.addPayment({ partner_id: ahmed, amount: 500, direction: 'from_partner', notes: 'دفع للشراكة' })
    const after = partners.ledger()
    assert.deepEqual(after.accounts.map((a) => [a.settled, a.balance]), [[1000, 5475], [-500, 5575]])
    assert.equal(after.payments.length, 2)

    assert.equal(err(() => partners.addPayment({ partner_id: mahmoud, amount: 0, direction: 'to_partner' })), 'INVALID_AMOUNT')
    assert.equal(err(() => partners.addPayment({ partner_id: 99999, amount: 5, direction: 'to_partner' })), 'PARTNER_NOT_FOUND')

    partners.removePayment({ id: after.payments[0].id })
    assert.equal(partners.ledger().payments.length, 1)
  })
  assert.equal(err(() => partners.ledger()), 'PERSONAL_WORKSPACE')
})

test('مبيعات كل شريك: عدد الفواتير والفلوس، والفلترة بالشريك وبالفترة', () => {
  withWorkspace(shop, () => {
    sales.createSale({ partner_id: mahmoud, sale_date: '2020-01-05', items: [{ item_id: shopItem().id, condition: 'new', quantity: 1, selling_price: 1800 }] })

    const byPartner = (from: string | null = null, to: string | null = null) =>
      partners.partnerSales({ from, to }).map((r) => [r.partner_id, r.invoices, r.total, r.net, r.paid])
    assert.deepEqual(byPartner(), [[mahmoud, 1, 1800, 1800, 1800], [ahmed, 1, 14000, 14000, 14000]])
    assert.deepEqual(byPartner('2020-01-01', '2020-01-31'), [[mahmoud, 1, 1800, 1800, 1800], [ahmed, 0, 0, 0, 0]])

    const page = sales.pageSales({ partnerId: mahmoud, pageSize: 100 })
    assert.deepEqual(page.rows.map((s) => [s.partner_id, s.partner_name, s.total]), [[mahmoud, 'محمود', 1800]])
    assert.equal(sales.pageSales({ pageSize: 100 }).total, 2)

    // التصدير: عمود الشريك بعد العميل، وبيتفلتر بالشريك
    const [invoices, lines] = exportData({ dataset: 'sales', partnerId: mahmoud })
    for (const sheet of [invoices, lines]) {
      const keys = sheet.columns.map((c) => c.key)
      assert.equal(keys[keys.indexOf('customer') + 1], 'partner')
      assert.deepEqual(sheet.rows.map((r) => r.partner), ['محمود'])
    }
    assert.deepEqual(exportData({ dataset: 'sales' })[0].rows.map((r) => r.partner), ['أحمد', 'محمود']) // الأحدث الأول
  })
  assert.ok(!exportData({ dataset: 'sales' })[0].columns.some((c) => c.key === 'partner')) // المخزون الفعلي ملوش شركاء
  // المخزون الفعلي ملوش شركاء: الشريك بيتجاهل
  assert.equal(err(() => partners.partnerSales()), 'PERSONAL_WORKSPACE')
})

test('حركات المنتج بتعرض التحويلات، وفروق الكميات الافتتاحية بتفضل صح', () => {
  const mine = items.getDetails({ id: personalItem })
  assert.equal(mine.movements.filter((m) => m.type === 'transfer_out').length, 3)
  assert.deepEqual([mine.adjustments.new, mine.adjustments.damaged], [10, 0]) // الافتتاحي بس

  withWorkspace(shop, () => {
    const d = items.getDetails({ id: shopItem().id })
    assert.equal(d.movements.filter((m) => m.type === 'transfer_in').length, 3)
    assert.deepEqual([d.adjustments.new, d.adjustments.damaged], [0, 0])
  })
})

test('المنتج المحوَّل مبيتحذفش نهائيًا (بيتأرشف)، والشراكة اللي عليها تحويلات متتحذفش', () => {
  assert.equal(items.removeItem({ id: personalItem }).mode, 'archived')
  assert.equal(err(() => ws.removeWorkspace({ id: shop })), 'WORKSPACE_NOT_EMPTY')
})

test('تعديل أسماء الشريكين بيحافظ على أرقامهم (علشان الحسابات تفضل مربوطة)', () => {
  ws.updateWorkspace({ id: shop, partners: ['محمود محمد', 'أحمد علي'] })
  const after = ws.listWorkspaces().find((w) => w.id === shop)!.partners
  assert.deepEqual(after.map((p) => [p.id, p.name]), [[mahmoud, 'محمود محمد'], [ahmed, 'أحمد علي']])
})
