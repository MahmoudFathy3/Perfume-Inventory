import assert from 'node:assert/strict'
import test from 'node:test'
import type { SaleInput } from '@shared/types'
import * as categories from '../features/categories/categories.service'
import * as customers from '../features/customers/customers.service'
import * as daily from '../features/dailyClosing/dailyClosing.service'
import * as expenses from '../features/expenses/expenses.service'
import * as items from '../features/items/items.service'
import * as partners from '../features/partners/partners.service'
import * as payments from '../features/payments/payments.service'
import * as purchases from '../features/purchases/purchases.service'
import * as sales from '../features/sales/sales.service'
import * as transfers from '../features/transfers/transfers.service'
import * as ws from '../features/workspaces/workspaces.service'
import { PERSONAL_WORKSPACE_ID as PERSONAL, withWorkspace } from '../lib/workspace'
import { err, one, useTestDb } from './helpers'

useTestDb()

const zero = { quantity: 0, purchase_price: 0, selling_price: 0, wholesale_price: 0 }
const DAY = '2025-05-10'
const NEXT = '2025-05-11'
let oud = 0
let cat = 0
let ali = 0
let saleId = 0
let expenseId = 0

const sale = (date: string, extra: Partial<SaleInput> = {}): SaleInput => ({
  customer_id: ali,
  sale_date: date,
  items: [{ item_id: oud, condition: 'new', quantity: 2, selling_price: 300 }],
  ...extra
})

test('تقرير اليوم في المخزون الفعلي: الإجماليات وكل حاجة اتعملت في اليوم للمحل', () => {
  cat = categories.createCategory({ name: 'عطور' })
  oud = items.createItem({ category_id: cat, name_ar: 'عود', stock: { new: { quantity: 20, purchase_price: 100, selling_price: 300, wholesale_price: 0 }, damaged: zero } })
  ali = customers.createCustomer({ name: 'علي' })
  saleId = sales.createSale(sale(DAY, { paid: 200 })) // 600 والباقي 400
  purchases.createPurchase({ supplier_name: 'مورد', purchase_date: DAY, paid: 60, items: [{ item_id: oud, condition: 'new', quantity: 1, purchase_price: 100 }] })
  expenseId = expenses.createExpense({ category: 'إيجار', amount: 30, expense_date: DAY })

  const r = daily.dailyClosing({ day: DAY })
  assert.equal(r.closed, null)
  assert.equal(r.can_close, true)
  assert.deepEqual(
    [r.totals.sales_count, r.totals.sales_total, r.totals.profit, r.totals.collected, r.totals.supplier_payments, r.totals.expenses, r.totals.net_cash],
    [1, 600, 400, 200, 60, 30, 110]
  )
  assert.equal(r.groups.length, 1)
  const [store] = r.groups
  assert.equal(store.kind, 'store')
  assert.deepEqual(store.sales.map((s) => [s.id, s.customer, s.total, s.paid, s.remaining]), [[saleId, 'علي', 600, 200, 400]])
  assert.deepEqual([store.purchases_total, store.purchases[0].supplier], [100, 'مورد'])
  assert.deepEqual(r.expenses.map((e) => [e.category, e.amount, e.deduct]), [['إيجار', 30, true]])
})

test('قفل اليوم: مفيش إضافة ولا تعديل ولا حذف بتاريخه، والتحصيل في يوم تاني على فاتورته مسموح', () => {
  daily.closeDay({ day: DAY, notes: 'تمام' })
  assert.equal(err(() => daily.closeDay({ day: DAY })), 'DAY_ALREADY_CLOSED')

  assert.equal(err(() => sales.createSale(sale(DAY))), 'DAY_CLOSED')
  assert.equal(err(() => sales.removeSale({ id: saleId })), 'DAY_CLOSED')
  assert.equal(err(() => sales.updateSale({ id: saleId, ...sale(NEXT) })), 'DAY_CLOSED', 'ولا نقلها ليوم تاني')
  assert.equal(err(() => expenses.createExpense({ category: 'إيجار', amount: 1, expense_date: DAY })), 'DAY_CLOSED')
  assert.equal(err(() => expenses.removeExpense({ id: expenseId })), 'DAY_CLOSED')
  assert.equal(err(() => purchases.createPurchase({ supplier_name: 'م', purchase_date: DAY, items: [{ item_id: oud, condition: 'new', quantity: 1, purchase_price: 1 }] })), 'DAY_CLOSED')
  const firstPayment = one<{ id: number }>('SELECT id FROM sale_payments WHERE sale_id = ? ORDER BY id LIMIT 1', saleId).id
  assert.equal(err(() => payments.removePayment({ id: firstPayment })), 'DAY_CLOSED', 'دفعة اليوم المقفول')
  assert.equal(err(() => payments.collect({ sale_id: saleId, amount: 50, payment_date: DAY })), 'DAY_CLOSED')

  // العميل دفع تاني يوم: مسموح، ودفعة اليوم المفتوح تتحذف عادي
  const [later] = payments.collect({ sale_id: saleId, amount: 100, payment_date: NEXT })
  payments.removePayment({ id: later })
  payments.collect({ sale_id: saleId, amount: 100, payment_date: NEXT })
  assert.ok(sales.createSale(sale(NEXT)) > 0, 'اليوم اللي بعده مفتوح')

  // التقرير المحفوظ مبيتغيّرش بحركات بعد كده
  const closed = daily.dailyClosing({ day: DAY })
  assert.equal(closed.closed!.notes, 'تمام')
  assert.equal(closed.groups[0].sales[0].remaining, 400)
  assert.deepEqual(daily.closedDays().map((d) => [d.day, d.sales_total, d.net_cash]), [[DAY, 600, 110]])
})

test('فتح اليوم تاني، والتواريخ الغلط واليوم اللي لسه ما جاش', () => {
  daily.reopenDay({ day: DAY })
  assert.equal(err(() => daily.reopenDay({ day: DAY })), 'DAY_NOT_CLOSED')
  expenses.removeExpense({ id: expenseId })
  assert.equal(daily.dailyClosing({ day: DAY }).totals.expenses, 0, 'بعد الفتح التقرير بيتحسب تاني')
  assert.equal(err(() => daily.closeDay({ day: '2099-01-01' })), 'DAY_NOT_ENDED')
  assert.equal(daily.dailyClosing({ day: '2099-01-01' }).can_close, false)
  assert.equal(err(() => daily.dailyClosing({ day: '2025-02-30' })), 'INVALID_DATE')
  assert.equal(err(() => daily.dailyClosing({ day: '10/05/2025' })), 'INVALID_DATE')
})

test('في الشراكة: كل شريك عمل إيه في اليوم بالتفصيل، والمشتريات مع بعض لوحدها، وقفل يوم الشراكة بيقفل تحويلاتها', () => {
  const shop = ws.createWorkspace({ partners: ['محمود', 'أحمد'] })
  const [mahmoud, ahmed] = ws.listWorkspaces().find((w) => w.id === shop)!.partners.map((p) => p.id)
  withWorkspace(shop, () => {
    const c = categories.createCategory({ name: 'مسكات' })
    const musk = items.createItem({ category_id: c, name_ar: 'مسك', stock: { new: { quantity: 10, purchase_price: 50, selling_price: 150, wholesale_price: 0 }, damaged: zero } })
    sales.createSale({ partner_id: mahmoud, sale_date: DAY, items: [{ item_id: musk, condition: 'new', quantity: 2, selling_price: 150 }] })
    purchases.createPurchase({ supplier_name: 'مورد أحمد', partner_id: ahmed, purchase_date: DAY, items: [{ item_id: musk, condition: 'new', quantity: 1, purchase_price: 50 }] })
    purchases.createPurchase({ supplier_name: 'مورد مشترك', joint: true, purchase_date: DAY, items: [{ item_id: musk, condition: 'new', quantity: 1, purchase_price: 40 }] })
    partners.addPayment({ partner_id: mahmoud, amount: 70, direction: 'to_partner', payment_date: DAY })

    const r = daily.dailyClosing({ day: DAY })
    const byKind = (kind: string, id?: number) => r.groups.find((g) => g.kind === kind && (id === undefined || g.partner?.id === id))!
    const m = byKind('partner', mahmoud)
    const a = byKind('partner', ahmed)
    assert.deepEqual([m.partner!.name, m.sales.length, m.sales_total, m.purchases.length, m.taken], ['محمود', 1, 300, 0, 70])
    assert.deepEqual([a.sales.length, a.purchases_total, a.purchases[0].supplier, a.taken], [0, 50, 'مورد أحمد', 0])
    assert.deepEqual(byKind('joint').purchases.map((p) => p.supplier), ['مورد مشترك'])
    assert.equal(r.groups.some((g) => g.kind === 'store'), false)

    // فاتورة آجل في اليوم: بتظهر للعلم في تقفيل اليوم بين الشركاء، ومبتمنعش القفل
    const zaki = customers.createCustomer({ name: 'زكي' })
    const credit = sales.createSale({ partner_id: ahmed, customer_id: zaki, sale_date: DAY, paid: 0, items: [{ item_id: musk, condition: 'new', quantity: 1, selling_price: 150 }] })
    const dayView = partners.dayPartnerClosing({ day: DAY })
    assert.deepEqual(dayView.unpaid.map((u) => [u.type, u.id, u.party, u.remaining]), [['sale', credit, 'زكي', 150]])

    // من غير تسوية اليوم مبيتقفلش، وبعد "تسوية الكل" بيتقفل
    assert.equal(err(() => daily.closeDay({ day: DAY })), 'DAY_NOT_SETTLED')
    partners.settleDay({ day: DAY })
    daily.closeDay({ day: DAY })
    assert.equal(err(() => partners.addPayment({ partner_id: ahmed, amount: 5, direction: 'to_partner', payment_date: DAY })), 'DAY_CLOSED')
    assert.ok(payments.collect({ sale_id: credit, amount: 150, payment_date: NEXT }).length > 0, 'العميل يدفع بعدين عادي')
  })
  // كل مخزن أيامه لوحده: الشراكة مقفولة يوم DAY بس المخزون الفعلي لأ (اتفتح فوق)
  assert.equal(daily.dailyClosing({ day: DAY }).closed, null)
  assert.equal(
    err(() => transfers.createTransfer({ from_workspace_id: PERSONAL, to_workspace_id: shop, kind: 'half', transfer_date: DAY, items: [{ item_id: oud, condition: 'new', quantity: 1 }] })),
    'DAY_CLOSED',
    'التحويل في يوم مقفول عند الطرف التاني'
  )
})
