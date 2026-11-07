/** أرقام الفترة المختارة: مشتريات ومبيعات ومرتجعات وأرباح، واللي اتحصّل من العملاء */
import { queryOne } from '../../../database/connection'
import { inWorkspace } from '../../../lib/workspace'
import type { Range, Totals } from './shared'
import { range, CUSTOMER_SHIPPING, SHOP_SHIPPING, RETURN_LOSS, TRANSFER_PROFIT, TRANSFER_PROFIT_FROM } from './shared'

/** مصروفات الفترة (إيجار، رواتب...): الكل، واللي بيتخصم من الربح */
export const expenses = (p: Range) =>
  queryOne<{ count: number; total: number; deducted: number }>(
    `SELECT COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total, COALESCE(SUM(CASE WHEN deduct = 1 THEN amount ELSE 0 END), 0) AS deducted
     FROM expenses WHERE ${inWorkspace('workspace_id')} AND ${range('expense_date')}`,
    { ...p }
  )!

/** الفلوس اللي اتحصّلت فعلًا في الفترة: الدفعات (مش اللي من رصيد العميل) − اللي اترد للعملاء كاش */
export const collected = (p: Range) =>
  queryOne<{ total: number }>(
    `SELECT COALESCE((SELECT SUM(sp.amount) FROM sale_payments sp JOIN sales s ON s.id = sp.sale_id
                      WHERE ${inWorkspace('s.workspace_id')} AND sp.from_credit = 0 AND ${range('sp.payment_date')}), 0)
          - COALESCE((SELECT SUM(r.amount) FROM sale_refunds r JOIN sales s ON s.id = r.sale_id
                      WHERE ${inWorkspace('s.workspace_id')} AND r.kind = 'cash' AND ${range('r.refund_date')}), 0) AS total`,
    { ...p }
  )!.total

export const salesOfDay = (day: string) =>
  queryOne<{ count: number; total: number }>(
    `SELECT COUNT(*) AS count, COALESCE(SUM(total - ${CUSTOMER_SHIPPING}), 0) AS total FROM sales WHERE ${inWorkspace('workspace_id')} AND sale_date = @day`,
    { day }
  )!

// ---- حسب الفلتر ----
export const purchases = (p: Range) =>
  queryOne<Totals>(
    `SELECT COUNT(*) AS count, COALESCE(SUM(total), 0) AS total, COALESCE(SUM(shipping_cost), 0) AS shipping
     FROM purchases WHERE ${inWorkspace('workspace_id')} AND ${range('purchase_date')}`,
    { ...p }
  )!

export const sales = (p: Range) =>
  queryOne<Totals & { products: number; shop_shipping: number }>(
    `SELECT COUNT(*) AS count, COALESCE(SUM(total - ${CUSTOMER_SHIPPING}), 0) AS products,
            COALESCE(SUM(${CUSTOMER_SHIPPING}), 0) AS shipping, COALESCE(SUM(${SHOP_SHIPPING}), 0) AS shop_shipping,
            COALESCE(SUM(total), 0) AS total
     FROM sales WHERE ${inWorkspace('workspace_id')} AND ${range('sale_date')}`,
    { ...p }
  )!

export const returnsOf = (type: 'sale' | 'purchase', p: Range) =>
  queryOne<{ count: number; total: number }>(
    `SELECT COUNT(*) AS count, COALESCE(SUM(total), 0) AS total FROM returns WHERE ${inWorkspace('workspace_id')} AND type = '${type}' AND ${range('return_date')}`,
    { ...p }
  )!

export const grossProfit = (p: Range) =>
  queryOne<{ profit: number }>(
    `SELECT COALESCE(SUM(si.quantity * (si.selling_price - si.purchase_price)), 0) AS profit
     FROM sale_items si JOIN sales s ON s.id = si.sale_id WHERE ${inWorkspace('s.workspace_id')} AND ${range('s.sale_date')}`,
    { ...p }
  )!.profit

/** ربح القطع اللي المخزن النشط باعها لمخزن تاني بسعر (اللي اتحصّل منه بس، بتاريخ التحصيل) */
export const transferProfit = (p: Range) =>
  queryOne<{ profit: number }>(
    `SELECT COALESCE(SUM(${TRANSFER_PROFIT}), 0) AS profit
     FROM ${TRANSFER_PROFIT_FROM} AND ${inWorkspace('t.from_workspace_id')} AND ${range('pp.payment_date')}`,
    { ...p }
  )!.profit

export const returnsLoss = (p: Range) =>
  queryOne<{ loss: number }>(
    `SELECT COALESCE(SUM(${RETURN_LOSS}), 0) AS loss
     FROM return_items ri JOIN returns r ON r.id = ri.return_id AND r.type = 'sale'
     WHERE ${inWorkspace('r.workspace_id')} AND ${range('r.return_date')}`,
    { ...p }
  )!.loss

/**
 * القطع اللي المخزن النشط باعها لمخازن تانية بسعر في الفترة (بتاريخ التحويل):
 * عدد التحويلات والقطع وإجمالي السعر، واللي اتدفع منها لحد دلوقتي
 */
export const transferSales = (p: Range) =>
  queryOne<{ count: number; pieces: number; total: number; paid: number }>(
    `SELECT COUNT(*) AS count,
            COALESCE(SUM((SELECT SUM(quantity - returned_quantity) FROM transfer_items WHERE transfer_id = t.id)), 0) AS pieces,
            COALESCE(SUM(t.total_price), 0) AS total,
            COALESCE(SUM((SELECT SUM(ABS(amount)) FROM partner_payments WHERE transfer_id = t.id)), 0) AS paid
     FROM transfers t WHERE t.kind = 'sale' AND t.total_price > 0 AND ${inWorkspace('t.from_workspace_id')} AND ${range('t.transfer_date')}`,
    { ...p }
  )!
