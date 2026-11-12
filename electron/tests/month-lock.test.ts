import assert from 'node:assert/strict'
import test from 'node:test'
import type { SaleInput } from '@shared/types'
import * as categories from '../features/categories/categories.service'
import * as customers from '../features/customers/customers.service'
import * as expenses from '../features/expenses/expenses.service'
import * as items from '../features/items/items.service'
import * as partners from '../features/partners/partners.service'
import * as payments from '../features/payments/payments.service'
import * as purchases from '../features/purchases/purchases.service'
import * as returns from '../features/returns/returns.service'
import * as sales from '../features/sales/sales.service'
import * as transfers from '../features/transfers/transfers.service'
import * as ws from '../features/workspaces/workspaces.service'
import { PERSONAL_WORKSPACE_ID as PERSONAL, withWorkspace } from '../lib/workspace'
import { err, one, useTestDb } from './helpers'

useTestDb()

const zero = { quantity: 0, purchase_price: 0, selling_price: 0, wholesale_price: 0 }
let shop = 0
let owner = 0
let ahmed = 0
let oud = 0 // في المخزون الفعلي
let musk = 0 // في الشراكة
let cat = 0
let customer = 0
let saleId = 0
let salePaymentId = 0
let purchaseId = 0
let transferId = 0
let expenseId = 0
let settlementId = 0
const inShop = <T>(fn: () => T) => withWorkspace(shop, fn)
const sale = (date: string, extra: Partial<SaleInput> = {}): SaleInput => ({
  partner_id: ahmed,
  customer_id: customer,
  sale_date: date,
  items: [{ item_id: musk, condition: 'new', quantity: 2, selling_price: 150 }],
  ...extra
})

test('تجهيز: يناير 2020 في الشراكة فيه بيع وشراء وتحويل ومصروف وتسوية، وحاجات لسه عليها فلوس', () => {
  const c = categories.createCategory({ name: 'عطور' })
  oud = items.createItem({ category_id: c, name_ar: 'عود', stock: { new: { quantity: 10, purchase_price: 100, selling_price: 300, wholesale_price: 0 }, damaged: zero } })
  shop = ws.createWorkspace({ partners: ['مصطفى', 'أحمد'] })
  ;[owner, ahmed] = ws.listWorkspaces().find((w) => w.id === shop)!.partners.map((p) => p.id)
  ws.setOwner({ name: 'مصطفى' })
  transferId = transfers.createTransfer({
    from_workspace_id: PERSONAL, to_workspace_id: shop, kind: 'sale', partner_id: owner, transfer_date: '2020-01-15',
    items: [{ item_id: oud, condition: 'new', quantity: 1, unit_price: 300 }]
  })
  inShop(() => {
    cat = categories.createCategory({ name: 'زيوت' })
    musk = items.createItem({ category_id: cat, name_ar: 'مسك', stock: { new: { quantity: 30, purchase_price: 50, selling_price: 150, wholesale_price: 0 }, damaged: zero } })
    customer = customers.createCustomer({ name: 'علي' })
    saleId = sales.createSale(sale('2020-01-10', { paid: 100 })) // باقي 200
    purchaseId = purchases.createPurchase({ supplier_name: 'مورد', partner_id: ahmed, purchase_date: '2020-01-12', paid: 0, items: [{ name_ar: 'عنبر', category_id: cat, condition: 'new', quantity: 3, purchase_price: 100 }] })
    expenseId = expenses.createExpense({ category: 'إيجار', amount: 100, expense_date: '2020-01-20' })
    settlementId = partners.addPayment({ partner_id: ahmed, amount: 50, direction: 'to_partner', payment_date: '2020-01-28' })
  })
})

test('مينفعش تقفّل شهر لسه عليه فلوس، ولا شهر لسه ما خلصش', () => {
  inShop(() => {
    const jan = partners.monthlyClosing({ month: '2020-01' })
    assert.equal(jan.closed, null)
    assert.equal(jan.ended, true)
    assert.deepEqual(jan.unpaid.map((u) => [u.type, u.id, u.remaining]), [
      ['sale', saleId, 200],
      ['purchase', purchaseId, 300],
      ['transfer', transferId, 300]
    ])
    assert.equal(jan.unpaid.find((u) => u.type === 'sale')!.party, 'علي')
    assert.equal(err(() => partners.closeMonth({ month: '2020-01' })), 'MONTH_HAS_UNPAID')
    assert.equal(err(() => partners.closeMonth({ month: '2099-01' })), 'MONTH_NOT_ENDED')
    assert.equal(partners.monthlyClosing({ month: '2099-01' }).ended, false)
  })
  assert.equal(err(() => partners.closeMonth({ month: '2020-01' })), 'PERSONAL_WORKSPACE')
})

test('بعد ما كله يتدفع الشهر بيتقفل وأرقامه بتتحفظ، وبتظهر في الشهور المقفولة', () => {
  inShop(() => {
    salePaymentId = payments.collect({ sale_id: saleId, amount: 200, payment_date: '2020-01-25' })[0]
    purchases.payPurchase({ purchase_id: purchaseId, amount: 300, payment_date: '2020-01-26' })
    transfers.payTransfer({ transfer_id: transferId, amount: 300, payment_date: '2020-02-02' }) // الدفع في فبراير عادي
    assert.deepEqual(partners.monthlyClosing({ month: '2020-01' }).unpaid, [])

    // من غير تسوية الشهر مبيتقفلش، وبعد "تسوية الكل" بيتقفل
    assert.equal(err(() => partners.closeMonth({ month: '2020-01' })), 'MONTH_NOT_SETTLED')
    const settled = partners.settleMonth({ month: '2020-01' })
    // التحويل اتدفع في فبراير: نصيب صاحبه من يناير بيتطرح منه الـ 300 دي (ميتدفعش مرتين)
    assert.ok(settled.every((s) => Math.abs(s.amount) < 300), 'مفيش 300 اتدفعوا تاني')
    const live = partners.monthlyClosing({ month: '2020-01' })
    assert.ok(live.rows.every((r) => r.due === 0))
    partners.closeMonth({ month: '2020-01', notes: 'اتقسم' })
    assert.equal(err(() => partners.closeMonth({ month: '2020-01' })), 'MONTH_ALREADY_CLOSED')

    const closed = partners.monthlyClosing({ month: '2020-01' })
    assert.equal(closed.closed!.notes, 'اتقسم')
    assert.deepEqual(closed.rows, live.rows, 'المحفوظ = المحسوب وقت التقفيل')
    assert.equal(closed.net_profit, live.net_profit)

    const [month] = partners.closedMonths()
    assert.equal(month.month, '2020-01')
    const a = month.rows.find((r) => r.partner.id === ahmed)!
    assert.equal(a.partner.name, 'أحمد')
    assert.ok(a.settled >= 50, 'أحمد خد الـ 50 بتوعه وتسوية آخر الشهر')

    // حركة جديدة في فبراير مبتغيّرش أرقام يناير المحفوظة
    expenses.createExpense({ category: 'إيجار', amount: 999, expense_date: '2020-02-05' })
    assert.deepEqual(partners.monthlyClosing({ month: '2020-01' }).rows, live.rows)
  })
})

test('الشهر المقفول: مفيش إضافة ولا تعديل ولا حذف لأي حاجة بتاريخ فيه', () => {
  inShop(() => {
    assert.equal(err(() => sales.createSale(sale('2020-01-05'))), 'MONTH_CLOSED')
    assert.equal(err(() => sales.updateSale({ id: saleId, ...sale('2020-02-01') })), 'MONTH_CLOSED', 'ولا نقلها لشهر مفتوح')
    assert.equal(err(() => sales.removeSale({ id: saleId })), 'MONTH_CLOSED')
    assert.equal(err(() => payments.removePayment({ id: salePaymentId })), 'MONTH_CLOSED')

    assert.equal(err(() => purchases.removePurchase({ id: purchaseId })), 'MONTH_CLOSED')
    const purchasePayment = one<{ id: number }>('SELECT id FROM purchase_payments WHERE purchase_id = ?', purchaseId).id
    assert.equal(err(() => purchases.removePurchasePayment({ id: purchasePayment })), 'MONTH_CLOSED')

    assert.equal(err(() => expenses.createExpense({ category: 'إيجار', amount: 10, expense_date: '2020-01-31' })), 'MONTH_CLOSED')
    assert.equal(err(() => expenses.removeExpense({ id: expenseId })), 'MONTH_CLOSED')
    assert.equal(err(() => expenses.updateExpense({ id: expenseId, category: 'إيجار', amount: 1, expense_date: '2020-03-01' })), 'MONTH_CLOSED')

    assert.equal(err(() => partners.addPayment({ partner_id: ahmed, amount: 10, direction: 'to_partner', payment_date: '2020-01-30' })), 'MONTH_CLOSED')
    assert.equal(err(() => partners.removePayment({ id: settlementId })), 'MONTH_CLOSED')
    assert.equal(err(() => partners.transferBetweenPartners({ from_partner_id: owner, to_partner_id: ahmed, amount: 5, payment_date: '2020-01-02' })), 'MONTH_CLOSED')
    assert.equal(err(() => returns.createReturn({ type: 'sale', sale_id: saleId, return_date: '2020-01-31', items: [{ item_id: musk, condition: 'new', quantity: 1, unit_price: 150 }] })), 'MONTH_CLOSED')

    // فبراير مفتوح عادي
    assert.ok(expenses.createExpense({ category: 'إيجار', amount: 10, expense_date: '2020-02-01' }) > 0)
  })

  // التحويل بتاريخ في يناير مقفول من ناحية الشراكة حتى لو بنعدّل من المخزون الفعلي
  assert.equal(err(() => transfers.removeTransfer({ id: transferId })), 'MONTH_CLOSED')
  assert.equal(err(() => transfers.unpayTransfer({ transfer_id: transferId })), 'MONTH_CLOSED')
  assert.equal(
    err(() => transfers.createTransfer({ from_workspace_id: PERSONAL, to_workspace_id: shop, kind: 'half', transfer_date: '2020-01-31', items: [{ item_id: oud, condition: 'new', quantity: 1 }] })),
    'MONTH_CLOSED'
  )
  // المخزون الفعلي نفسه مش مقفول: بيع فيه بتاريخ يناير عادي
  assert.ok(sales.createSale({ sale_date: '2020-01-20', items: [{ item_id: oud, condition: 'new', quantity: 1, selling_price: 300 }] }) > 0)
})

test('فتح الشهر تاني بيرجّع التعديل، وبيشيل الأرقام المحفوظة', () => {
  inShop(() => {
    partners.reopenMonth({ month: '2020-01' })
    assert.equal(err(() => partners.reopenMonth({ month: '2020-01' })), 'MONTH_NOT_CLOSED')
    assert.equal(partners.monthlyClosing({ month: '2020-01' }).closed, null)
    assert.deepEqual(partners.closedMonths(), [])
    expenses.removeExpense({ id: expenseId })
    assert.equal(err(() => partners.monthlyClosing({ month: '2020-1' })), 'INVALID_MONTH')
  })
})
