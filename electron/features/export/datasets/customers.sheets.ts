import { queryAll } from '../../../database/connection'
import { dateClause } from '../../../lib/dateRange'
import { searchClause } from '../../../lib/search'
import { scoped } from '../../../lib/workspace'
import { findAll as findCustomers } from '../../customers/customers.repository'
import { type Row, type SheetDef, col } from './sheet'

/** العملاء بإجماليات فواتيرهم (في الفترة لو متحددة، زي جدول العملاء) */
export const customersSheet: SheetDef = {
  key: 'customers',
  columns: [col('name', 'text', 26), col('phone', 'text', 18), col('sales_count', 'number', 12), col('total', 'money'), col('paid', 'money'), col('remaining', 'money')],
  rows: ({ search, from, to }) =>
    findCustomers({ search, from, to }).map((c) => ({ name: c.name, phone: c.phone, sales_count: c.sales_count, total: c.total, paid: c.paid, remaining: c.remaining }))
}

/** الدفعات (بتاريخ الدفعة في الفترة لو متحددة) */
export const paymentsSheet: SheetDef = {
  key: 'payments',
  columns: [col('date', 'date'), col('customer', 'text', 24), col('invoice', 'number', 10), col('amount', 'money'), col('notes', 'text', 28)],
  rows: ({ search, ...range }) => {
    const { where, params } = scoped('s.workspace_id', searchClause(['cu.name'], search))
    const dates = dateClause('p.payment_date', range)
    return queryAll<Row>(
      `SELECT p.payment_date AS date, cu.name AS customer, s.id AS invoice, p.amount, p.notes
       FROM sale_payments p JOIN sales s ON s.id = p.sale_id JOIN customers cu ON cu.id = s.customer_id
       ${where} ${dates.where} ORDER BY p.payment_date DESC, p.id DESC`,
      { ...params, ...dates.params }
    )
  }
}
