import type { DateFilter, ExpenseInput, PageParams } from '@shared/types'
import { AppError, positiveAmount, today } from '../../lib/errors'
import * as repo from './expenses.repository'

type ExpensesFilter = { search?: string; category?: string } & DateFilter

/**
 * فحص المصروف: النوع مطلوب (ولو مكتوب قبل كده بكتابة تانية بناخد القديمة علشان ميتكررش)،
 * والمبلغ أكبر من صفر، والخصم من الربح افتراضي.
 */
function clean(input: ExpenseInput): repo.ExpenseRow {
  const typed = String(input.category ?? '').trim()
  if (!typed) throw new AppError('EXPENSE_TYPE_REQUIRED')
  return {
    expense_date: input.expense_date || today(),
    category: repo.existingCategory(typed) ?? typed,
    amount: positiveAmount(input.amount),
    deduct: input.deduct === false ? 0 : 1,
    notes: input.notes?.trim() || null
  }
}

export const pageExpenses = (p: ExpensesFilter & PageParams) => repo.findPage(p, p)
/** إجماليات نفس الفلتر (كل الصفحات مش الصفحة الحالية بس) */
export const expensesTotals = (p: ExpensesFilter) => repo.totals(p)
export const listCategories = () => repo.categories()
export const createExpense = (input: ExpenseInput): number => repo.insert(clean(input))

export function updateExpense({ id, ...input }: ExpenseInput & { id: number }): void {
  if (!repo.findById(id)) throw new AppError('EXPENSE_NOT_FOUND')
  repo.update(id, clean(input))
}

export const removeExpense = ({ id }: { id: number }): void => repo.remove(id)
