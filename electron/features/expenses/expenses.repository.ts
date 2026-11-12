import type { DateFilter, Expense, Page, PageParams } from '@shared/types'
import { execute, queryAll, queryOne } from '../../database/connection'
import { dateClause } from '../../lib/dateRange'
import { queryPage } from '../../lib/pagination'
import { searchClause } from '../../lib/search'
import { activeWorkspaceId, inWorkspace, scoped } from '../../lib/workspace'

export interface ExpenseRow {
  expense_date: string
  category: string
  amount: number
  deduct: number
  notes: string | null
}

export type ListOptions = { search?: string; category?: string } & DateFilter

export function filterClause(opts: ListOptions) {
  const { where, params } = scoped('workspace_id', searchClause(['category', 'notes'], opts.search))
  const dates = dateClause('expense_date', opts)
  const byCategory = opts.category ? 'AND norm(category) = norm(@category)' : ''
  return { where: `${where} ${byCategory} ${dates.where}`, params: { ...params, ...dates.params, category: opts.category } }
}

export function findPage(opts: ListOptions, page: PageParams): Page<Expense> {
  const { where, params } = filterClause(opts)
  return queryPage<Expense>(`SELECT id, expense_date, category, amount, deduct, notes FROM expenses ${where} ORDER BY expense_date DESC, id DESC`, params, page)
}

/** إجماليات نفس الفلتر: الكل واللي بيتخصم من الربح */
export function totals(opts: ListOptions): { count: number; total: number; deducted: number } {
  const { where, params } = filterClause(opts)
  return queryOne<{ count: number; total: number; deducted: number }>(
    `SELECT COUNT(*) AS count, ROUND(COALESCE(SUM(amount), 0), 2) AS total,
            ROUND(COALESCE(SUM(CASE WHEN deduct = 1 THEN amount ELSE 0 END), 0), 2) AS deducted
     FROM expenses ${where}`,
    params
  )!
}

/** الأنواع اللي اتسجلت قبل كده في المخزن ده (للاختيار وقت التسجيل وللفلتر)، الأكتر استخدامًا الأول */
export const categories = (): string[] =>
  queryAll<{ category: string }>(
    `SELECT category FROM expenses WHERE ${inWorkspace('workspace_id')} GROUP BY norm(category) ORDER BY COUNT(*) DESC, category`
  ).map((r) => r.category)

/** نفس النوع مكتوب قبل كده (من غير تفرقة همزة/تاء مربوطة) علشان ميتكررش بكتابتين */
export const existingCategory = (name: string) =>
  queryOne<{ category: string }>(`SELECT category FROM expenses WHERE ${inWorkspace('workspace_id')} AND norm(category) = norm(?) LIMIT 1`, [name])?.category

export const findById = (id: number) =>
  queryOne<Expense>(`SELECT id, expense_date, category, amount, deduct, notes FROM expenses WHERE id = ? AND ${inWorkspace('workspace_id')}`, [id])

export const insert = (e: ExpenseRow) =>
  execute(
    'INSERT INTO expenses(workspace_id, expense_date, category, amount, deduct, notes) VALUES (@workspace_id, @expense_date, @category, @amount, @deduct, @notes)',
    { ...e, workspace_id: activeWorkspaceId() }
  )
export const update = (id: number, e: ExpenseRow) =>
  void execute('UPDATE expenses SET expense_date = @expense_date, category = @category, amount = @amount, deduct = @deduct, notes = @notes WHERE id = @id', { ...e, id })
export const remove = (id: number) => void execute(`DELETE FROM expenses WHERE id = ? AND ${inWorkspace('workspace_id')}`, [id])
