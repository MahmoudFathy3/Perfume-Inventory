import type { ExportParams } from '@shared/types'
import { queryAll } from '../../../database/connection'
import { filterClause, totals } from '../../expenses/expenses.repository'
import { type Row, type SheetDef, col } from './sheet'

/** نفس فلتر صفحة المصروفات: البحث والنوع والفترة */
const optionsOf = ({ search, category, from, to }: ExportParams) => ({ search, category, from, to })

export const expensesSheet: SheetDef = {
  key: 'expenses',
  columns: [col('id', 'number', 10), col('date', 'date'), col('expense_type', 'text', 22), col('amount', 'money'), col('deduct', 'enum', 22), col('notes', 'text', 34)],
  rows: (f) => {
    const { where, params } = filterClause(optionsOf(f))
    return queryAll<Row>(
      `SELECT id, expense_date AS date, category AS expense_type, amount,
              CASE WHEN deduct = 1 THEN 'expense_deducted' ELSE 'expense_record_only' END AS deduct, notes
       FROM expenses ${where} ORDER BY expense_date DESC, id DESC`,
      params
    )
  }
}

/** إجماليات نفس الفلتر */
export const expensesSummarySheet: SheetDef = {
  key: 'expenses_summary',
  layout: 'record',
  columns: [col('expenses_count', 'number'), col('total', 'money'), col('deducted_total', 'money'), col('record_only_total', 'money')],
  rows: (f) => {
    const t = totals(optionsOf(f))
    return [{ expenses_count: t.count, total: t.total, deducted_total: t.deducted, record_only_total: Math.round((t.total - t.deducted) * 100) / 100 }]
  }
}
