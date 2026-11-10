import assert from 'node:assert/strict'
import test from 'node:test'
import * as categories from '../features/categories/categories.service'
import * as dashboard from '../features/dashboard/dashboard.service'
import * as expenses from '../features/expenses/expenses.service'
import * as items from '../features/items/items.service'
import * as partners from '../features/partners/partners.service'
import * as sales from '../features/sales/sales.service'
import * as ws from '../features/workspaces/workspaces.service'
import { withWorkspace } from '../lib/workspace'
import { err, useTestDb } from './helpers'

useTestDb()

const zero = { quantity: 0, purchase_price: 0, selling_price: 0, wholesale_price: 0 }

test('المصروف: النوع والمبلغ مطلوبين، والنوع المكتوب بكتابة تانية بيتوحّد مع القديم', () => {
  assert.equal(err(() => expenses.createExpense({ category: ' ', amount: 100 })), 'EXPENSE_TYPE_REQUIRED')
  assert.equal(err(() => expenses.createExpense({ category: 'إيجار', amount: 0 })), 'INVALID_AMOUNT')

  expenses.createExpense({ category: 'إيجار', amount: 3000, expense_date: '2026-01-01' })
  expenses.createExpense({ category: 'ايجار', amount: 3000, expense_date: '2026-02-01' }) // نفس النوع من غير همزة
  expenses.createExpense({ category: 'راتب', amount: 2000, expense_date: '2026-01-15', notes: 'أحمد' })
  expenses.createExpense({ category: 'سلفة', amount: 500, expense_date: '2026-01-20', deduct: false })

  assert.deepEqual(expenses.listCategories(), ['إيجار', 'راتب', 'سلفة'])
  const page = expenses.pageExpenses({ pageSize: 100 })
  assert.equal(page.total, 4)
  assert.deepEqual(page.rows.filter((e) => e.category === 'إيجار').length, 2)
})

test('الفلتر بالنوع والفترة والبحث، والإجماليات بتفرّق بين اللي بيتخصم والتسجيل بس', () => {
  assert.deepEqual(expenses.expensesTotals({}), { count: 4, total: 8500, deducted: 8000 })
  assert.deepEqual(expenses.expensesTotals({ from: '2026-01-01', to: '2026-01-31' }), { count: 3, total: 5500, deducted: 5000 })
  assert.deepEqual(expenses.expensesTotals({ category: 'ايجار' }), { count: 2, total: 6000, deducted: 6000 })
  assert.equal(expenses.pageExpenses({ pageSize: 100, search: 'أحمد' }).rows[0].category, 'راتب')
})

test('تعديل وحذف', () => {
  const advance = expenses.pageExpenses({ pageSize: 100, category: 'سلفة' }).rows[0]
  expenses.updateExpense({ id: advance.id, category: 'سلفة', amount: 700, expense_date: advance.expense_date, deduct: true })
  assert.deepEqual(expenses.expensesTotals({ category: 'سلفة' }), { count: 1, total: 700, deducted: 700 })
  expenses.removeExpense({ id: advance.id })
  assert.equal(expenses.expensesTotals({}).count, 3)
  assert.equal(err(() => expenses.updateExpense({ id: 99999, category: 'x', amount: 1 })), 'EXPENSE_NOT_FOUND')
})

test('الرئيسية: صافي الربح = الربح الفعلي − اللي بيتخصم، في الفترة', () => {
  const cat = categories.createCategory({ name: 'دخوني' })
  const item = items.createItem({ category_id: cat, name_ar: 'خليفه', stock: { new: { quantity: 10, purchase_price: 500, selling_price: 2000, wholesale_price: 0 }, damaged: zero } })
  sales.createSale({ sale_date: '2026-01-10', items: [{ item_id: item, condition: 'new', quantity: 5 }] }) // ربح 7500
  expenses.createExpense({ category: 'تسجيل', amount: 999, expense_date: '2026-01-10', deduct: false })

  const jan = dashboard.summary({ from: '2026-01-01', to: '2026-01-31' })
  assert.equal(jan.profit, 7500)
  // يناير: إيجار 3000 + راتب 2000 بيتخصموا، و999 تسجيل بس (السلفة اتحذفت)
  assert.deepEqual(jan.expenses, { count: 3, total: 5999, deducted: 5000 })
  assert.equal(jan.net_profit, 2500)
  assert.equal(dashboard.summary({ from: '2026-02-01', to: '2026-02-28' }).expenses.deducted, 3000)
})

test('الشراكة: مصروفاتها لوحدها، ونصيب كل شريك من صافي الربح', () => {
  const shop = ws.createWorkspace({ partners: ['محمود', 'أحمد'] })
  withWorkspace(shop, () => {
    assert.deepEqual(expenses.expensesTotals({}), { count: 0, total: 0, deducted: 0 }) // مصروفات الفعلي مبتظهرش هنا
    const cat = categories.createCategory({ name: 'دخوني' })
    const item = items.createItem({ category_id: cat, name_ar: 'روز', stock: { new: { quantity: 2, purchase_price: 100, selling_price: 600, wholesale_price: 0 }, damaged: zero } })
    const [mahmoud] = ws.listWorkspaces().find((w) => w.id === shop)!.partners
    sales.createSale({ partner_id: mahmoud.id, items: [{ item_id: item, condition: 'new', quantity: 2 }] }) // ربح 1000
    expenses.createExpense({ category: 'إيجار', amount: 400 })
    expenses.createExpense({ category: 'سلفة', amount: 100, deduct: false })

    const ledger = partners.ledger()
    assert.equal(ledger.profit, 600)
    assert.deepEqual(ledger.accounts.map((a) => a.profit_share), [300, 300])
  })
  assert.equal(err(() => ws.removeWorkspace({ id: shop })), 'WORKSPACE_NOT_EMPTY')
})
