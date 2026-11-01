import type { Customer, CustomerSummary, Page, PageParams } from '@shared/types'
import { execute, queryAll, queryOne } from '../../database/connection'
import { queryPage } from '../../lib/pagination'
import { searchClause } from '../../lib/search'
import { activeWorkspaceId, inWorkspace, scoped } from '../../lib/workspace'

/** رصيد كل فاتورة لعميل: المدفوع والمرتجع (المتبقي = الإجمالي - المرتجع - المدفوع، مش أقل من صفر) */
const BALANCES = `
  WITH balances AS (
    SELECT s.id, s.customer_id, s.total,
           COALESCE((SELECT SUM(amount) FROM sale_payments p WHERE p.sale_id = s.id), 0) AS paid,
           COALESCE((SELECT SUM(total) FROM returns r WHERE r.sale_id = s.id), 0) AS returns_total
    FROM sales s WHERE s.customer_id IS NOT NULL
  )`

/** العملاء مع إجماليات فواتيرهم. owing = اللي عليهم فلوس بس. */
type ListOptions = { search?: string; owing?: boolean }

function listQuery(opts: ListOptions) {
  const { where, params } = scoped('c.workspace_id', searchClause(['c.name', 'c.phone'], opts.search))
  const sql = `${BALANCES}
     SELECT c.id, c.name, c.phone, COUNT(b.id) AS sales_count,
            ROUND(COALESCE(SUM(b.total), 0), 2) AS total,
            ROUND(COALESCE(SUM(b.paid), 0), 2) AS paid,
            ROUND(COALESCE(SUM(MAX(0, ROUND(b.total - b.returns_total - b.paid, 2))), 0), 2) AS remaining
     FROM customers c LEFT JOIN balances b ON b.customer_id = c.id
     ${where} GROUP BY c.id ${opts.owing ? 'HAVING remaining > 0' : ''} ORDER BY c.name`
  return { sql, params }
}

/** كل العملاء (للقوايم المنسدلة والتصدير) */
export function findAll(opts: ListOptions = {}): CustomerSummary[] {
  const { sql, params } = listQuery(opts)
  return queryAll<CustomerSummary>(sql, params)
}

/** صفحة واحدة من العملاء */
export function findPage(opts: ListOptions, page: PageParams): Page<CustomerSummary> {
  const { sql, params } = listQuery(opts)
  return queryPage<CustomerSummary>(sql, params, page)
}

export const findById = (id: number) =>
  queryOne<Customer>(`SELECT id, name, phone FROM customers WHERE id = ? AND ${inWorkspace('workspace_id')}`, [id])

/** عميل بنفس الاسم (من غير تفرقة همزة/تاء مربوطة)، مع استثناء العميل نفسه وقت التعديل */
export const findByName = (name: string, excludeId = 0) =>
  queryOne<{ id: number }>(`SELECT id FROM customers WHERE ${inWorkspace('workspace_id')} AND norm(name) = norm(?) AND id != ?`, [name, excludeId])

export const insert = (name: string, phone: string | null) =>
  execute('INSERT INTO customers(workspace_id, name, phone) VALUES (?, ?, ?)', [activeWorkspaceId(), name, phone])
export const update = (id: number, name: string, phone: string | null) =>
  void execute(`UPDATE customers SET name = ?, phone = ? WHERE id = ? AND ${inWorkspace('workspace_id')}`, [name, phone, id])
export const remove = (id: number) => void execute(`DELETE FROM customers WHERE id = ? AND ${inWorkspace('workspace_id')}`, [id])
