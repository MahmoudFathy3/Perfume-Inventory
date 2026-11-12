import assert from 'node:assert/strict'
import test from 'node:test'
import * as categories from '../features/categories/categories.service'
import * as expenses from '../features/expenses/expenses.service'
import * as items from '../features/items/items.service'
import * as partners from '../features/partners/partners.service'
import * as sales from '../features/sales/sales.service'
import * as transfers from '../features/transfers/transfers.service'
import * as ws from '../features/workspaces/workspaces.service'
import { PERSONAL_WORKSPACE_ID as PERSONAL, withWorkspace } from '../lib/workspace'
import { err, useTestDb } from './helpers'

useTestDb()

const zero = { quantity: 0, purchase_price: 0, selling_price: 0, wholesale_price: 0 }

test('تسوية الكل: كل شريك بياخد الباقي له (أو بيدفع اللي عليه) بتاريخ آخر الشهر، والباقي بيبقى صفر', () => {
  const c = categories.createCategory({ name: 'عطور' })
  const oud = items.createItem({ category_id: c, name_ar: 'عود', stock: { new: { quantity: 10, purchase_price: 100, selling_price: 300, wholesale_price: 0 }, damaged: zero } })
  const shop = ws.createWorkspace({ partners: ['محمود', 'أحمد'] })
  const [mahmoud, ahmed] = ws.listWorkspaces().find((w) => w.id === shop)!.partners.map((p) => p.id)
  // محمود باع للشراكة قطعة بـ 300 (ليه)، والشراكة باعتها بـ 500 (ربح 200 بالنص)
  transfers.createTransfer({ from_workspace_id: PERSONAL, to_workspace_id: shop, kind: 'sale', partner_id: mahmoud, transfer_date: '2025-03-05', items: [{ item_id: oud, condition: 'new', quantity: 1, unit_price: 300 }] })
  withWorkspace(shop, () => {
    const item = items.listItems({}).find((i) => i.name_ar === 'عود')!
    sales.createSale({ partner_id: ahmed, sale_date: '2025-03-10', items: [{ item_id: item.id, condition: 'new', quantity: 1, selling_price: 500 }] })
    expenses.createExpense({ category: 'إيجار', amount: 400, expense_date: '2025-03-20' }) // صافي الربح −200: على كل واحد 100

    const before = partners.monthlyClosing({ month: '2025-03' })
    const closingOf = (id: number) => before.rows.find((r) => r.partner.id === id)!.closing
    assert.deepEqual([closingOf(mahmoud), closingOf(ahmed)], [200, -100], 'محمود ليه 300 − 100، وأحمد عليه 100')

    const settled = partners.settleMonth({ month: '2025-03', notes: 'تسوية مارس' })
    assert.deepEqual(settled.map((s) => [s.partner_id, s.amount]), [[mahmoud, 200], [ahmed, -100]], 'نفس الباقي لكل شريك')

    const after = partners.monthlyClosing({ month: '2025-03' })
    assert.ok(after.rows.every((r) => r.closing === 0), 'الباقي آخر الشهر صفر للكل')
    assert.deepEqual(after.rows.map((r) => r.settled), [200, -100], 'اتسجلت في الشهر')
    assert.deepEqual(after.unpaid, [], 'التحويل اتعلّم مدفوع (300 دفعة تحويل + −100 تسوية لمحمود)')
    const transferPayment = partners.ledger().payments.find((p) => p.partner_id === mahmoud && p.transfer_id !== null)!
    assert.deepEqual([transferPayment.amount, transferPayment.payment_date, transferPayment.notes], [300, '2025-03-31', 'تسوية مارس'])
    assert.ok(partners.ledger().accounts.every((a) => a.balance === 0))

    assert.equal(err(() => partners.settleMonth({ month: '2025-03' })), 'NOTHING_TO_SETTLE')
    partners.closeMonth({ month: '2025-03' })
    assert.equal(err(() => partners.settleMonth({ month: '2025-03' })), 'MONTH_CLOSED')
    assert.equal(err(() => partners.settleMonth({ month: '2099-01' })), 'MONTH_NOT_ENDED')
  })
})

test('التسوية العادية: المبلغ يروح الأول لتحويلات البيع اللي ما اتدفعتش (الأقدم الأول)، والباقي تسوية، فمحدش ياخد مرتين', () => {
  const c = categories.createCategory({ name: 'مسك' })
  const musk = items.createItem({ category_id: c, name_ar: 'مسك', stock: { new: { quantity: 10, purchase_price: 50, selling_price: 200, wholesale_price: 0 }, damaged: zero } })
  const shop = ws.createWorkspace({ partners: ['خالد', 'سامي'] })
  const [khaled] = ws.listWorkspaces().find((w) => w.id === shop)!.partners.map((p) => p.id)
  const t1 = transfers.createTransfer({ from_workspace_id: PERSONAL, to_workspace_id: shop, kind: 'sale', partner_id: khaled, transfer_date: '2025-04-01', items: [{ item_id: musk, condition: 'new', quantity: 1, unit_price: 200 }] })
  const t2 = transfers.createTransfer({ from_workspace_id: PERSONAL, to_workspace_id: shop, kind: 'sale', partner_id: khaled, transfer_date: '2025-04-02', items: [{ item_id: musk, condition: 'new', quantity: 1, unit_price: 200 }] })
  withWorkspace(shop, () => {
    const account = () => partners.ledger().accounts.find((a) => a.partner.id === khaled)!
    assert.deepEqual(account().unpaid_transfers, { owed_to: 400, owed_by: 0 })

    // 300: الأول بيتدفع كله (200)، والتاني 100
    partners.addPayment({ partner_id: khaled, amount: 300, direction: 'to_partner', payment_date: '2025-04-10', apply_to_transfers: true })
    const paidOf = (id: number) => transfers.pageTransfers({ pageSize: 50 }).rows.find((t) => t.id === id)!.paid
    assert.deepEqual([paidOf(t1), paidOf(t2)], [200, 100])
    assert.deepEqual(account().unpaid_transfers, { owed_to: 100, owed_by: 0 })

    // 150: الـ 100 الباقية للتحويل التاني، والـ 50 تسوية عادية
    partners.addPayment({ partner_id: khaled, amount: 150, direction: 'to_partner', payment_date: '2025-04-11', apply_to_transfers: true })
    assert.equal(paidOf(t2), 200)
    assert.deepEqual(account().unpaid_transfers, { owed_to: 0, owed_by: 0 })
    assert.equal(account().settled, 450, 'الإجمالي اللي خده زي ما هو')

    // من غير الاختيار: تسوية عادية بس (زي الأول)
    const before = account().settled
    partners.addPayment({ partner_id: khaled, amount: 10, direction: 'to_partner', payment_date: '2025-04-12' })
    assert.equal(account().settled, before + 10)
  })
})

test('التقفيل اليومي في حسابات الشركاء: حساب كل شريك ليوم واحد، وتسوية الكل لليوم، والقفل بيحفظ الحساب', async () => {
  const daily = await import('../features/dailyClosing/dailyClosing.service')
  const c = categories.createCategory({ name: 'عنبر' })
  const amber = items.createItem({ category_id: c, name_ar: 'عنبر', stock: { new: { quantity: 10, purchase_price: 100, selling_price: 300, wholesale_price: 0 }, damaged: zero } })
  const shop = ws.createWorkspace({ partners: ['ياسر', 'هاني'] })
  const [yasser, hany] = ws.listWorkspaces().find((w) => w.id === shop)!.partners.map((p) => p.id)
  transfers.createTransfer({ from_workspace_id: PERSONAL, to_workspace_id: shop, kind: 'capital', partner_id: yasser, transfer_date: '2025-06-01', items: [{ item_id: amber, condition: 'new', quantity: 4 }] })
  withWorkspace(shop, () => {
    const item = items.listItems({}).find((i) => i.name_ar === 'عنبر')!
    sales.createSale({ partner_id: hany, sale_date: '2025-06-01', items: [{ item_id: item.id, condition: 'new', quantity: 1, selling_price: 300 }] }) // ربح 200
    sales.createSale({ partner_id: yasser, sale_date: '2025-06-02', items: [{ item_id: item.id, condition: 'new', quantity: 1, selling_price: 500 }] }) // ربح 400

    const day2 = partners.dayPartnerClosing({ day: '2025-06-02' })
    assert.equal(day2.period, 'day')
    assert.deepEqual([day2.from, day2.to, day2.net_profit], ['2025-06-02', '2025-06-02', 400])
    const rowOf = (c: typeof day2, id: number) => c.rows.find((r) => r.partner.id === id)!
    assert.deepEqual([rowOf(day2, yasser).opening, rowOf(day2, yasser).profit_share, rowOf(day2, yasser).closing], [100, 200, 300], 'أول اليوم = نصيبه من ربح امبارح')

    partners.settleDay({ day: '2025-06-02', notes: 'تسوية اليوم' })
    const settled = partners.dayPartnerClosing({ day: '2025-06-02' })
    assert.ok(settled.rows.every((r) => r.closing === 0))
    assert.deepEqual(settled.rows.map((r) => r.settled), [300, 300])

    daily.closeDay({ day: '2025-06-02' })
    const closed = partners.dayPartnerClosing({ day: '2025-06-02' })
    assert.ok(closed.closed)
    assert.deepEqual(closed.rows, settled.rows, 'حساب الشركاء اتحفظ مع اليوم')
    const [listed] = partners.closedPartnerDays()
    assert.deepEqual([listed.month, listed.net_profit, listed.rows.length], ['2025-06-02', 400, 2])
    assert.equal(err(() => partners.settleDay({ day: '2025-06-02' })), 'DAY_CLOSED')
    assert.equal(err(() => partners.settleDay({ day: '2099-01-01' })), 'DAY_NOT_ENDED')
  })
})
