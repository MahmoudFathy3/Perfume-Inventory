import type { HandleFn } from '../../lib/ipc'
import * as s from './expenses.service'

export function register(handle: HandleFn): void {
  handle('expenses:page', s.pageExpenses)
  handle('expenses:totals', s.expensesTotals)
  handle('expenses:categories', s.listCategories)
  handle('expenses:create', s.createExpense)
  handle('expenses:update', s.updateExpense)
  handle('expenses:remove', s.removeExpense)
}
