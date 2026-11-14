import type { Condition, DateFilter, Page, PageParams, PriceType, SaleOrder, SaleOrderLine, ShippingPayer } from '@shared/types'
import { execute, queryAll, queryOne } from '../../database/connection'
import { dateClause } from '../../lib/dateRange'
import { queryPage } from '../../lib/pagination'
import { searchClause } from '../../lib/search'

export interface OrderRow {
  order_date: string
  customer_id: number | null
  partner_id: number | null
  price_type: PriceType
  shipping_payer: ShippingPayer
  shipping_cost: number
  total: number
  deposit: number
  notes: string | null
}

export interface OrderLineRow {
  item_id: number
  condition: Condition
  quantity: number
  selling_price: number
  source_workspace_id: number | null
  transfer_price: number | null
}

const SELECT = `
  SELECT o.id, o.workspace_id, o.order_date, o.customer_id, cu.name AS customer_name, o.partner_id, wp.name AS partner_name,
         o.price_type, o.shipping_payer, o.shipping_cost, o.total, o.deposit, o.notes,
         (SELECT COUNT(*) FROM sale_order_items WHERE order_id = o.id) AS lines_count,
         (SELECT COALESCE(SUM(quantity), 0) FROM sale_order_items WHERE order_id = o.id) AS pieces,
         (SELECT group_concat(i.name_ar || ' ' || COALESCE(i.name_en, ''), ' ') FROM sale_order_items l JOIN items i ON i.id = l.item_id WHERE l.order_id = o.id) AS item_names
  FROM sale_orders o LEFT JOIN customers cu ON cu.id = o.customer_id LEFT JOIN workspace_partners wp ON wp.id = o.partner_id`

/** طلبات المخزن ده (الأقدم الأول: أول طلب اتعمل أول واحد يتجهّز) */
export function findPage(ws: number, opts: { search?: string } & DateFilter, page: PageParams): Page<SaleOrder> {
  const { where, params } = searchClause(['customer_name', 'partner_name', 'notes', 'item_names'], opts.search, 'AND')
  const dates = dateClause('order_date', opts)
  return queryPage<SaleOrder>(`SELECT * FROM (${SELECT}) WHERE workspace_id = @ws ${where} ${dates.where} ORDER BY order_date, id`, { ...params, ...dates.params, ws }, page)
}

export const count = (ws: number): number => queryOne<{ n: number }>('SELECT COUNT(*) AS n FROM sale_orders WHERE workspace_id = ?', [ws])!.n

export const findById = (id: number, ws: number) => queryOne<SaleOrder>(`${SELECT} WHERE o.id = ? AND o.workspace_id = ?`, [id, ws])

export const findLines = (id: number) =>
  queryAll<SaleOrderLine>(
    `SELECT l.id, l.item_id, i.name_ar, i.name_en, i.category_id, l.condition, l.quantity, l.selling_price, l.source_workspace_id, l.transfer_price
     FROM sale_order_items l JOIN items i ON i.id = l.item_id WHERE l.order_id = ? ORDER BY l.id`,
    [id]
  )

/** سعر البيع (قطاعي أو جملة) للمنتج في حالته، لو السطر من غير سعر */
export const stockPrices = (itemId: number, condition: Condition) =>
  queryOne<{ selling_price: number; wholesale_price: number }>('SELECT selling_price, wholesale_price FROM item_stock WHERE item_id = ? AND condition = ?', [itemId, condition])

/** المنتج موجود في المخزن ده (مخزن الطلب أو المخزن التاني اللي السطر جاي منه) */
export const itemInWorkspace = (itemId: number, ws: number) => !!queryOne('SELECT 1 FROM items WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL', [itemId, ws])

const HEADER = 'order_date, customer_id, partner_id, price_type, shipping_payer, shipping_cost, total, deposit, notes'
const VALUES = '@order_date, @customer_id, @partner_id, @price_type, @shipping_payer, @shipping_cost, @total, @deposit, @notes'

export const insert = (ws: number, o: OrderRow) => execute(`INSERT INTO sale_orders(workspace_id, ${HEADER}) VALUES (@ws, ${VALUES})`, { ...o, ws })

export const update = (id: number, o: OrderRow) =>
  void execute(
    `UPDATE sale_orders SET order_date = @order_date, customer_id = @customer_id, partner_id = @partner_id, price_type = @price_type,
       shipping_payer = @shipping_payer, shipping_cost = @shipping_cost, total = @total, deposit = @deposit, notes = @notes WHERE id = @id`,
    { ...o, id }
  )

export function replaceLines(id: number, lines: OrderLineRow[]): void {
  execute('DELETE FROM sale_order_items WHERE order_id = ?', [id])
  for (const l of lines) {
    execute(
      `INSERT INTO sale_order_items(order_id, item_id, condition, quantity, selling_price, source_workspace_id, transfer_price)
       VALUES (@order_id, @item_id, @condition, @quantity, @selling_price, @source_workspace_id, @transfer_price)`,
      { ...l, order_id: id }
    )
  }
}

export const remove = (id: number) => void execute('DELETE FROM sale_orders WHERE id = ?', [id])

/** المحجوز في منتجات المخزن ده (من طلبات أي مخزن): القطع وقيمتها بسعر الطلب وعدد المنتجات والطلبات */
export const reservedSummary = (ws: number) =>
  queryOne<{ pieces: number; value: number; items: number; orders: number }>(
    `SELECT COALESCE(SUM(l.quantity), 0) AS pieces, ROUND(COALESCE(SUM(l.quantity * l.selling_price), 0), 2) AS value,
            COUNT(DISTINCT l.item_id) AS items, COUNT(DISTINCT l.order_id) AS orders
     FROM sale_order_items l JOIN items i ON i.id = l.item_id WHERE i.workspace_id = ?`,
    [ws]
  )!

/** الطلبات اللي حاجزة منتج معين (ممكن تكون في مخزن تاني لو القطعة جاية منه) */
export const ordersForItem = (itemId: number) =>
  queryAll<{ order_id: number; workspace_id: number; order_date: string; customer_name: string | null; condition: string; quantity: number; selling_price: number }>(
    `SELECT o.id AS order_id, o.workspace_id, o.order_date, cu.name AS customer_name, l.condition, l.quantity, l.selling_price
     FROM sale_order_items l JOIN sale_orders o ON o.id = l.order_id LEFT JOIN customers cu ON cu.id = o.customer_id
     WHERE l.item_id = ? ORDER BY o.order_date, o.id`,
    [itemId]
  )
