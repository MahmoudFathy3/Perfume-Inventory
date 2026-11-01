import { queryAll } from '../../../database/connection'
import { searchClause } from '../../../lib/search'
import { scoped } from '../../../lib/workspace'
import { findAll as findCustomers } from '../../customers/customers.repository'
import { type Row, type SheetDef, col } from './sheet'

export const customersSheet: SheetDef = {
  key: 'customers',
  columns: [col('name', 'text', 26), col('phone', 'text', 18), col('sales_count', 'number', 12), col('total', 'money'), col('paid', 'money'), col('remaining', 'money')],
  rows: ({ search }) => findCustomers({ search }).map((c) => ({ name: c.name, phone: c.phone, sales_count: c.sales_count, total: c.total, paid: c.paid, remaining: c.remaining }))
}

export const paymentsSheet: SheetDef = {
  key: 'payments',
  columns: [col('date', 'date'), col('customer', 'text', 24), col('invoice', 'number', 10), col('amount', 'money'), col('notes', 'text', 28)],
  rows: ({ search }) => {
    const { where, params } = scoped('s.workspace_id', searchClause(['cu.name'], search))
    return queryAll<Row>(
      `SELECT p.payment_date AS date, cu.name AS customer, s.id AS invoice, p.amount, p.notes
       FROM sale_payments p JOIN sales s ON s.id = p.sale_id JOIN customers cu ON cu.id = s.customer_id
       ${where} ORDER BY p.payment_date DESC, p.id DESC`,
      params
    )
  }
}
