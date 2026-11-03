import assert from 'node:assert/strict'
import test from 'node:test'
import * as categories from '../features/categories/categories.service'
import * as expenses from '../features/expenses/expenses.service'
import * as items from '../features/items/items.service'
import * as partners from '../features/partners/partners.service'
import * as purchases from '../features/purchases/purchases.service'
import * as transfers from '../features/transfers/transfers.service'
import * as ws from '../features/workspaces/workspaces.service'
import { PERSONAL_WORKSPACE_ID as PERSONAL, withWorkspace } from '../lib/workspace'
import { err, useTestDb } from './helpers'

useTestDb()

const sum = (lines: { amount: number }[]) => Math.round(lines.reduce((s, l) => s + l.amount, 0) * 100) / 100

test('كشف حساب الشريك: كل بند مجموع حركاته = رقمه في الجدول، والمعادلة بتطلع الباقي', () => {
  const cat = categories.createCategory({ name: 'دخوني' })
  const item = items.createItem({
    category_id: cat,
    name_ar: 'خليفه',
    stock: { new: { quantity: 10, purchase_price: 500, selling_price: 2000, wholesale_price: 0 }, damaged: { quantity: 0, purchase_price: 0, selling_price: 0, wholesale_price: 0 } }
  })
  const shop = ws.createWorkspace({ partners: ['محمود', 'أحمد'] })
  const [mahmoud, ahmed] = ws.listWorkspaces().find((w) => w.id === shop)!.partners.map((p) => p.id)
  const move = (kind: 'capital' | 'sale', quantity: number, extra = {}) =>
    transfers.createTransfer({ from_workspace_id: PERSONAL, to_workspace_id: shop, kind, partner_id: mahmoud, items: [{ item_id: item, condition: 'new', quantity, ...extra }] })

  move('capital', 2) // رأس مال 1000
  move('sale', 1, { unit_price: 700 }) // باع للشراكة بـ 700

  withWorkspace(shop, () => {
    purchases.createPurchase({ supplier_name: 'مورد', partner_id: mahmoud, paid_by_partner: true, items: [{ name_ar: 'عود', category_id: cat, condition: 'new', quantity: 3, purchase_price: 100 }] }) // دفع 300
    partners.addPayment({ partner_id: mahmoud, amount: 200, direction: 'to_partner', notes: 'دفعة' })
    partners.transferBetweenPartners({ from_partner_id: ahmed, to_partner_id: mahmoud, amount: 50 }) // أحمد إدّاله 50
    expenses.createExpense({ category: 'إيجار', amount: 100 })

    const s = partners.statement({ partner_id: mahmoud })
    const a = s.account
    // كل بند = مجموع حركاته
    assert.equal(sum(s.lines.capital), a.capital)
    assert.equal(sum(s.lines.sold), a.sold)
    assert.equal(sum(s.lines.paid_out), a.paid_out)
    assert.equal(sum(s.lines.settled), a.settled)
    assert.deepEqual([a.capital, a.sold, a.paid_out, a.settled], [1000, 700, 250, 200]) // 300 − 50 استلمها من أحمد

    // نصيب الربح: (الربح الفعلي − المصروفات) × النسبة
    assert.equal(s.profit.expenses, 100)
    assert.equal(s.profit.net, s.profit.actual - 100)
    assert.equal(a.profit_share, Math.round(((s.profit.net * s.profit.share_percent) / 100) * 100) / 100)

    // المعادلة اللي بتتعرض = الباقي
    assert.equal(Math.round((a.profit_share + a.sold + a.paid_out - a.settled) * 100) / 100, a.balance)

    // أنواع الحركات بتتعرف صح
    assert.deepEqual(s.lines.paid_out.map((l) => [l.ref_type, l.amount, l.notes]), [['purchase', 300, 'مورد'], ['pair', -50, 'أحمد']])
    assert.deepEqual(s.lines.settled.map((l) => [l.ref_type, l.amount, l.notes]), [['payment', 200, 'دفعة']])

    assert.equal(err(() => partners.statement({ partner_id: 99999 })), 'PARTNER_NOT_FOUND')
  })
  assert.equal(err(() => partners.statement({ partner_id: mahmoud })), 'PERSONAL_WORKSPACE')
})
