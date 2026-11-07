import type { Condition, DateFilter, FreeInvoice, FreeInvoiceLine, FreeInvoicePayment, Page, PageParams, PriceType } from '@shared/types'
import { execute, queryAll, queryOne } from '../../database/connection'
import { dateClause } from '../../lib/dateRange'
import { queryPage } from '../../lib/pagination'
import { searchClause } from '../../lib/search'

export interface HeaderRow {
  invoice_date: string
  customer_id: number | null
  customer_name: string | null
  customer_phone: string | null
  price_type: PriceType
  shipping_cost: number
  discount: number
  total: number
  notes: string | null
}

export interface LineRow {
  item_id: number | null
  condition: Condition | null
  name: string
  quantity: number
  unit_price: number
}

const PAID = 'COALESCE((SELECT SUM(amount) FROM free_invoice_payments WHERE invoice_id = f.id), 0)'

// اسم العميل: المتسجل لو موجود، وإلا المكتوب. ومعاه أسماء البنود علشان البحث يلاقي الفاتورة باسم أي منتج فيها
const SELECT = `
  SELECT f.id, f.invoice_date, f.customer_id, COALESCE(cu.name, f.customer_name) AS customer_name,
         COALESCE(f.customer_phone, cu.phone) AS customer_phone, f.price_type, f.shipping_cost, f.discount, f.total, f.notes, f.sale_id,
         ROUND(${PAID}, 2) AS paid, MAX(0, ROUND(f.total - ${PAID}, 2)) AS remaining,
         (SELECT COUNT(*) FROM free_invoice_items WHERE invoice_id = f.id) AS lines_count,
         (SELECT COUNT(*) FROM free_invoice_items WHERE invoice_id = f.id AND item_id IS NOT NULL) AS stock_lines,
         (SELECT group_concat(name, ' ') FROM free_invoice_items WHERE invoice_id = f.id) AS line_names
  FROM free_invoices f LEFT JOIN customers cu ON cu.id = f.customer_id`

type ListOptions = { search?: string } & DateFilter

export function findPage(opts: ListOptions, page: PageParams): Page<FreeInvoice> {
  const { where, params } = searchClause(['customer_name', 'customer_phone', 'notes', 'line_names'], opts.search, 'AND')
  const dates = dateClause('invoice_date', opts)
  return queryPage<FreeInvoice>(
    `SELECT * FROM (${SELECT}) WHERE 1 = 1 ${where} ${dates.where} ORDER BY invoice_date DESC, id DESC`,
    { ...params, ...dates.params },
    page
  )
}

export const findById = (id: number) => queryOne<FreeInvoice>(`${SELECT} WHERE f.id = ?`, [id])

export const findLines = (id: number) =>
  queryAll<FreeInvoiceLine>(
    `SELECT l.id, l.item_id, l.condition, l.name, i.name_en, l.quantity, l.unit_price
     FROM free_invoice_items l LEFT JOIN items i ON i.id = l.item_id WHERE l.invoice_id = ? ORDER BY l.id`,
    [id]
  )

export const findPayments = (id: number) =>
  queryAll<FreeInvoicePayment>('SELECT id, amount, payment_date, notes FROM free_invoice_payments WHERE invoice_id = ? ORDER BY payment_date, id', [id])

export const findPayment = (id: number) => queryOne<{ id: number; invoice_id: number }>('SELECT id, invoice_id FROM free_invoice_payments WHERE id = ?', [id])

export const sumPayments = (id: number): number =>
  queryOne<{ paid: number }>('SELECT COALESCE(SUM(amount), 0) AS paid FROM free_invoice_payments WHERE invoice_id = ?', [id])!.paid

const HEADER_SET = `invoice_date = @invoice_date, customer_id = @customer_id, customer_name = @customer_name, customer_phone = @customer_phone,
  price_type = @price_type, shipping_cost = @shipping_cost, discount = @discount, total = @total, notes = @notes`

export const insertHeader = (h: HeaderRow) =>
  execute(
    `INSERT INTO free_invoices(invoice_date, customer_id, customer_name, customer_phone, price_type, shipping_cost, discount, total, notes)
     VALUES (@invoice_date, @customer_id, @customer_name, @customer_phone, @price_type, @shipping_cost, @discount, @total, @notes)`,
    { ...h }
  )

export const updateHeader = (id: number, h: HeaderRow) => void execute(`UPDATE free_invoices SET ${HEADER_SET} WHERE id = @id`, { ...h, id })

export function replaceLines(id: number, lines: LineRow[]): void {
  execute('DELETE FROM free_invoice_items WHERE invoice_id = ?', [id])
  for (const l of lines) {
    execute(
      'INSERT INTO free_invoice_items(invoice_id, item_id, condition, name, quantity, unit_price) VALUES (@invoice_id, @item_id, @condition, @name, @quantity, @unit_price)',
      { ...l, invoice_id: id }
    )
  }
}

export const remove = (id: number) => void execute('DELETE FROM free_invoices WHERE id = ?', [id])

export const insertPayment = (invoiceId: number, amount: number, date: string, notes: string | null) =>
  execute('INSERT INTO free_invoice_payments(invoice_id, amount, payment_date, notes) VALUES (?, ?, ?, ?)', [invoiceId, amount, date, notes])

export const removePayment = (id: number) => void execute('DELETE FROM free_invoice_payments WHERE id = ?', [id])

export const setSale = (id: number, saleId: number | null) => void execute('UPDATE free_invoices SET sale_id = ? WHERE id = ?', [saleId, id])

/** منتج من المخزون النشط (اسمه بيتاخد منه لو السطر من غير اسم) */
export const findItem = (id: number, workspaceId: number) =>
  queryOne<{ name_ar: string }>('SELECT name_ar FROM items WHERE id = ? AND workspace_id = ?', [id, workspaceId])

export const customerExists = (id: number, workspaceId: number) =>
  !!queryOne('SELECT 1 FROM customers WHERE id = ? AND workspace_id = ?', [id, workspaceId])
