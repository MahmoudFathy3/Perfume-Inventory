import assert from 'node:assert/strict'
import test from 'node:test'
import * as categories from '../features/categories/categories.service'
import * as expenses from '../features/expenses/expenses.service'
import { loadSheets } from '../features/export/datasets'
import * as items from '../features/items/items.service'
import * as partners from '../features/partners/partners.service'
import * as purchases from '../features/purchases/purchases.service'
import * as transfers from '../features/transfers/transfers.service'
import * as warehouse from '../features/warehouse/warehouse.service'
import * as ws from '../features/workspaces/workspaces.service'
import { PERSONAL_WORKSPACE_ID as PERSONAL, withWorkspace } from '../lib/workspace'
import { err, useTestDb } from './helpers'

useTestDb()

const r2 = (v: number) => Math.round(v * 100) / 100

let cat = 0
let item = 0
let shop = 0
let mahmoud = 0
let ahmed = 0
const inShop = <T>(fn: () => T) => withWorkspace(shop, fn)

test('تقفيل الشهر: الباقي أول الشهر = آخر الشهر اللي قبله، وآخر شهر = الباقي في حسابات الشركاء', () => {
  cat = categories.createCategory({ name: 'دخوني' })
  item = items.createItem({
    category_id: cat,
    name_ar: 'خليفه',
    stock: { new: { quantity: 10, purchase_price: 500, selling_price: 2000, wholesale_price: 0 }, damaged: { quantity: 0, purchase_price: 0, selling_price: 0, wholesale_price: 0 } }
  })
  shop = ws.createWorkspace({ partners: ['محمود', 'أحمد'] })
  ;[mahmoud, ahmed] = ws.listWorkspaces().find((w) => w.id === shop)!.partners.map((p) => p.id)

  // يناير: رأس مال + باع للشراكة بـ 700 + دفع فاتورة 300 من جيبه + إيجار 100
  transfers.createTransfer({ from_workspace_id: PERSONAL, to_workspace_id: shop, kind: 'capital', partner_id: mahmoud, transfer_date: '2030-01-05', items: [{ item_id: item, condition: 'new', quantity: 2 }] })
  transfers.createTransfer({ from_workspace_id: PERSONAL, to_workspace_id: shop, kind: 'sale', partner_id: mahmoud, transfer_date: '2030-01-10', items: [{ item_id: item, condition: 'new', quantity: 1, unit_price: 700 }] })
  inShop(() => {
    purchases.createPurchase({ supplier_name: 'مورد', partner_id: mahmoud, paid_by_partner: true, purchase_date: '2030-01-15', items: [{ name_ar: 'عود', category_id: cat, condition: 'new', quantity: 3, purchase_price: 100 }] })
    expenses.createExpense({ category: 'إيجار', amount: 100, expense_date: '2030-01-20' })
    // فبراير: سحب 200 + إيجار 50 + أحمد إدّى محمود 30
    partners.addPayment({ partner_id: mahmoud, amount: 200, direction: 'to_partner', payment_date: '2030-02-03' })
    expenses.createExpense({ category: 'إيجار', amount: 50, expense_date: '2030-02-10' })
    partners.transferBetweenPartners({ from_partner_id: ahmed, to_partner_id: mahmoud, amount: 30, payment_date: '2030-02-12' })

    const jan = partners.monthlyClosing({ month: '2030-01' })
    assert.deepEqual([jan.from, jan.to], ['2030-01-01', '2030-01-31'])
    assert.deepEqual([jan.expenses, jan.net_profit], [100, r2(jan.profit - 100)])
    const m = jan.rows.find((r) => r.partner.id === mahmoud)!
    const share = m.partner.share_percent / 100
    assert.deepEqual([m.opening, m.sold, m.paid_out, m.settled, m.capital], [0, 700, 300, 0, 1000])
    assert.equal(m.profit_share, r2(jan.net_profit * share))
    assert.equal(m.closing, r2(m.opening + m.profit_share + m.sold + m.paid_out - m.settled))

    const feb = partners.monthlyClosing({ month: '2030-02' })
    const fm = feb.rows.find((r) => r.partner.id === mahmoud)!
    const fa = feb.rows.find((r) => r.partner.id === ahmed)!
    assert.equal(fm.opening, m.closing, 'أول فبراير = آخر يناير')
    assert.deepEqual([fm.sold, fm.paid_out, fm.settled, feb.expenses], [0, -30, 200, 50]) // استلم 30 من أحمد
    assert.equal(fa.paid_out, 30, 'أحمد دفع لمحمود من جيبه')

    // آخر شهر فيه حركات = الباقي في حسابات الشركاء
    const ledger = partners.ledger().accounts
    assert.equal(fm.closing, ledger.find((a) => a.partner.id === mahmoud)!.balance)
    assert.equal(fa.closing, ledger.find((a) => a.partner.id === ahmed)!.balance)

    // شهر فاضي بعد كده: مفيش حركات والباقي زي ما هو
    const mar = partners.monthlyClosing({ month: '2030-03' })
    assert.deepEqual(mar.rows.map((r) => [r.opening, r.closing]), feb.rows.map((r) => [r.closing, r.closing]))
    assert.equal(partners.monthlyClosing({ month: '2030-02' }).to, '2030-02-28')

    assert.equal(err(() => partners.monthlyClosing({ month: '2030-13' })), 'INVALID_MONTH')
    assert.equal(err(() => partners.monthlyClosing({ month: '' })), 'INVALID_MONTH')
  })
  assert.equal(err(() => partners.monthlyClosing({ month: '2030-01' })), 'PERSONAL_WORKSPACE')
})

test('تصدير تقفيل الشهر: ملخص الشهر وسطر لكل شريك', () => {
  inShop(() => {
    const [summary, rows] = loadSheets('partner_closing', { month: '2030-01' })
    assert.equal(summary.layout, 'record')
    assert.equal(summary.rows[0].month, '2030-01')
    assert.equal(summary.rows[0].deducted_total, 100)
    const closing = partners.monthlyClosing({ month: '2030-01' })
    assert.deepEqual(rows.rows.map((r) => r.closing_balance), closing.rows.map((r) => r.closing))
  })
})

test('تصدير المصروفات بنفس الفلتر (النوع والفترة) ومعاه الإجماليات', () => {
  inShop(() => {
    expenses.createExpense({ category: 'مرتب', amount: 1000, deduct: false, expense_date: '2030-01-25' })
    const [all, totals] = loadSheets('expenses', {})
    assert.equal(all.rows.length, 3)
    assert.deepEqual(totals.rows[0], { expenses_count: 3, total: 1150, deducted_total: 150, record_only_total: 1000 })
    assert.equal(all.rows.find((r) => r.expense_type === 'مرتب')!.deduct, 'expense_record_only')

    const [rent] = loadSheets('expenses', { category: 'ايجار', from: '2030-01-01', to: '2030-01-31' }) // من غير همزة
    assert.deepEqual(rent.rows.map((r) => r.amount), [100])
  })
})

test('تصدير التحويلات بنفس فلتر الصفحة، والمخازن والأنواع بقيم بتتترجم', () => {
  const [list, lines] = loadSheets('transfers', {})
  assert.equal(list.rows.length, 2)
  const sale = list.rows.find((r) => r.transfer_kind === 'transfer_sale')!
  assert.deepEqual([sale.direction, sale.from_store, sale.transfer_price, sale.paid, sale.remaining], ['transfer_out', 'personal', 700, 0, 700])
  const capital = list.rows.find((r) => r.transfer_kind === 'transfer_capital')!
  assert.deepEqual([capital.transfer_price, capital.remaining], [null, null], 'رأس المال ملوش سعر ولا دفع')
  assert.equal(lines.rows.length, 2)

  assert.equal(loadSheets('transfers', { kind: 'sale' })[0].rows.length, 1)
  assert.equal(loadSheets('transfers', { payment: 'unpaid' })[0].rows.length, 1)
  assert.equal(loadSheets('transfers', { from: '2030-01-06' })[0].rows.length, 1)
  assert.equal(loadSheets('transfers', { direction: 'in' })[0].rows.length, 0)
  // من ناحية الشراكة نفس التحويلات داخلة
  inShop(() => assert.ok(loadSheets('transfers', {})[0].rows.every((r) => r.direction === 'transfer_in')))
})

test('تصدير المخزن الخارجي: المنتجات بتكلفتها والشحنات ومحتواها', () => {
  const saudi = ws.createWorkspace({ kind: 'warehouse', name: 'مخزن جدة' })
  withWorkspace(saudi, () => {
    const oud = warehouse.createItem({ name: 'عود', quantity: 10, unit_price: 100, shipping: 10, customs: 5 })
    warehouse.createShipment({ workspace_id: PERSONAL, ship_date: '2030-01-01', items: [{ item_id: oud, quantity: 4 }] })

    const [itemsSheet, shipments, shipmentLines] = loadSheets('warehouse', {})
    assert.deepEqual(itemsSheet.rows.map((r) => [r.name, r.quantity, r.unit_cost_sar, r.total_cost_sar]), [['عود', 6, 115, 690]])
    assert.deepEqual(shipments.rows.map((r) => [r.destination, r.shipment_status, r.pieces, r.contents]), [['personal', 'in_transit', 4, 'عود × 4']])
    assert.equal(shipmentLines.rows.length, 1)
    assert.equal(loadSheets('warehouse', { search: 'مش موجود' })[0].rows.length, 0)
  })
})
