import type { DateFilter, Expense, ExpenseInput, ExpensesTotals, Page, PageParams } from '@shared/types'
import { invoke } from '@/shared/api/ipc'

export type ExpensesFilter = { search?: string; category?: string } & DateFilter

export const expensesApi = {
  page: (p: ExpensesFilter & PageParams) => invoke<Page<Expense>>('expenses:page', p),
  /** إجماليات نفس الفلتر */
  totals: (p: ExpensesFilter) => invoke<ExpensesTotals>('expenses:totals', p),
  /** الأنواع اللي اتسجلت قبل كده (الأكتر استخدامًا الأول) */
  categories: () => invoke<string[]>('expenses:categories'),
  create: (p: ExpenseInput) => invoke<number>('expenses:create', p),
  update: (p: ExpenseInput & { id: number }) => invoke<void>('expenses:update', p),
  remove: (p: { id: number }) => invoke<void>('expenses:remove', p)
}
