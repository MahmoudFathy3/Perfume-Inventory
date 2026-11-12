import type { DailyReport, DayExpense, DayPurchase, DayReturn, DaySale, DaySettlement } from '@shared/types'
import { execute, queryAll, queryOne } from '../../database/connection'
import { salePaid, saleRemaining } from '../../lib/salePaid'

type Day = { ws: number; day: string }

/** فواتير بيع اليوم ومين عملها (partner_id) والمدفوع والباقي عليها لحد دلوقتي */
export const sales = (p: Day) =>
  queryAll<DaySale & { partner_id: number | null }>(
    `SELECT s.id, s.partner_id, cu.name AS customer, s.total,
            ROUND(${salePaid('s.id')}, 2) AS paid, ${saleRemaining('s.id', 's.total')} AS remaining
     FROM sales s LEFT JOIN customers cu ON cu.id = s.customer_id
     WHERE s.workspace_id = @ws AND s.sale_date = @day ORDER BY s.id`,
    p
  )

/** مرتجعات البيع اللي اتعملت في اليوم (والشريك اللي عمل فاتورتها) */
export const returns = (p: Day) =>
  queryAll<DayReturn & { partner_id: number | null }>(
    `SELECT r.id, r.sale_id, r.total, s.partner_id FROM returns r LEFT JOIN sales s ON s.id = r.sale_id
     WHERE r.workspace_id = @ws AND r.type = 'sale' AND r.return_date = @day ORDER BY r.id`,
    p
  )

export const purchases = (p: Day) =>
  queryAll<DayPurchase & { partner_id: number | null; joint: number }>(
    `SELECT id, partner_id, joint, supplier_name AS supplier, total, paid_by_partner = 1 AS paid_by_partner
     FROM purchases WHERE workspace_id = @ws AND purchase_date = @day ORDER BY id`,
    p
  ).map((r) => ({ ...r, paid_by_partner: !!r.paid_by_partner }))

/** تسويات الشركاء في اليوم (الشراكة بس) */
export const settlements = (p: Day) =>
  queryAll<DaySettlement & { partner_id: number }>(
    `SELECT id, partner_id, amount, notes,
            CASE WHEN pair_id IS NOT NULL THEN 'pair' WHEN transfer_id IS NOT NULL THEN 'transfer_payment' ELSE 'payment' END AS kind
     FROM partner_payments WHERE workspace_id = @ws AND payment_date = @day ORDER BY id`,
    p
  )

export const expenses = (p: Day) =>
  queryAll<DayExpense>(
    'SELECT id, category, amount, deduct = 1 AS deduct, notes FROM expenses WHERE workspace_id = @ws AND expense_date = @day ORDER BY id',
    p
  ).map((e) => ({ ...e, deduct: !!e.deduct }))

/** اللي اتدفع للموردين في اليوم (على أي فاتورة شراء) */
export const supplierPayments = (p: Day): number =>
  queryOne<{ total: number }>(
    `SELECT COALESCE(SUM(pp.amount), 0) AS total FROM purchase_payments pp JOIN purchases pu ON pu.id = pp.purchase_id
     WHERE pu.workspace_id = @ws AND pp.payment_date = @day`,
    p
  )!.total

// ---------- الأيام المقفولة ----------
interface ClosingRow {
  id: number
  day: string
  closed_at: string
  notes: string | null
  report: string
}

export const findClosing = (ws: number, day: string) =>
  queryOne<ClosingRow>('SELECT id, day, closed_at, notes, report FROM day_closings WHERE workspace_id = ? AND day = ?', [ws, day])

export const findClosings = (ws: number, limit: number) =>
  queryAll<ClosingRow>('SELECT id, day, closed_at, notes, report FROM day_closings WHERE workspace_id = ? ORDER BY day DESC LIMIT ?', [ws, limit])

export const insertClosing = (ws: number, day: string, report: DailyReport, notes: string | null) =>
  execute(
    "INSERT INTO day_closings(workspace_id, day, closed_at, notes, report) VALUES (?, ?, datetime('now','localtime'), ?, ?)",
    [ws, day, notes, JSON.stringify(report)]
  )

export const removeClosing = (id: number) => void execute('DELETE FROM day_closings WHERE id = ?', [id])
