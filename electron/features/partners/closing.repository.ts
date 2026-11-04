import type { ClosingUnpaid, MonthlyClosing, PartnerClosingRow } from '@shared/types'
import { execute, queryAll, queryOne } from '../../database/connection'
import { saleRemaining } from '../../lib/salePaid'

/**
 * اللي لسه عليه فلوس في شهر الشراكة: فواتير البيع (على العملاء)، وفواتير الشراء (للموردين، غير اللي الشريك دفعها من جيبه)،
 * وتحويلات البيع بسعر اللي الشراكة طرف فيها
 */
export const unpaid = (ws: number, month: string) =>
  queryAll<ClosingUnpaid>(
    `SELECT * FROM (
       SELECT 'sale' AS type, s.id, s.sale_date AS date, cu.name AS party, ${saleRemaining('s.id', 's.total')} AS remaining
       FROM sales s LEFT JOIN customers cu ON cu.id = s.customer_id
       WHERE s.workspace_id = @ws AND substr(s.sale_date, 1, 7) = @month
       UNION ALL
       SELECT 'purchase', p.id, p.purchase_date, p.supplier_name,
              MAX(0, ROUND(p.total - COALESCE((SELECT SUM(total) FROM returns WHERE purchase_id = p.id), 0)
                                   - COALESCE((SELECT SUM(amount) FROM purchase_payments WHERE purchase_id = p.id), 0), 2))
       FROM purchases p
       WHERE p.workspace_id = @ws AND p.paid_by_partner = 0 AND substr(p.purchase_date, 1, 7) = @month
       UNION ALL
       SELECT 'transfer', t.id, t.transfer_date, wp.name,
              MAX(0, ROUND(t.total_price - COALESCE((SELECT ABS(SUM(amount)) FROM partner_payments WHERE transfer_id = t.id), 0), 2))
       FROM transfers t LEFT JOIN workspace_partners wp ON wp.id = t.partner_id
       WHERE t.kind = 'sale' AND (t.from_workspace_id = @ws OR t.to_workspace_id = @ws) AND substr(t.transfer_date, 1, 7) = @month
     ) WHERE remaining > 0.005 ORDER BY date, type, id`,
    { ws, month }
  )

interface ClosingRow {
  id: number
  month: string
  closed_at: string
  notes: string | null
  sales_count: number
  sales_total: number
  sales_returns: number
  profit: number
  expenses: number
  net_profit: number
}

const PARTNER_COLUMNS = `partner_id, partner_name, share_percent, opening, profit_share, sold, paid_out, settled, closing, capital`

type PartnerRowDb = Omit<PartnerClosingRow, 'partner'> & { closing_id: number; partner_id: number; partner_name: string; share_percent: number }

const toRow = ({ partner_id, partner_name, share_percent, closing_id: _, ...r }: PartnerRowDb): PartnerClosingRow => ({
  partner: { id: partner_id, name: partner_name, share_percent },
  ...r
})

export const findClosing = (ws: number, month: string) =>
  queryOne<ClosingRow>('SELECT * FROM month_closings WHERE workspace_id = ? AND month = ?', [ws, month])

/** شهور الشراكة المقفولة (الأحدث الأول) ومعاها حسابات الشركاء */
export function findClosings(ws: number): (ClosingRow & { rows: PartnerClosingRow[] })[] {
  const closings = queryAll<ClosingRow>('SELECT * FROM month_closings WHERE workspace_id = ? ORDER BY month DESC', [ws])
  const rows = queryAll<PartnerRowDb>(
    `SELECT closing_id, ${PARTNER_COLUMNS} FROM month_closing_partners
     WHERE closing_id IN (SELECT id FROM month_closings WHERE workspace_id = ?) ORDER BY id`,
    [ws]
  )
  return closings.map((c) => ({ ...c, rows: rows.filter((r) => r.closing_id === c.id).map(toRow) }))
}

export const findClosingRows = (closingId: number) =>
  queryAll<PartnerRowDb>(`SELECT closing_id, ${PARTNER_COLUMNS} FROM month_closing_partners WHERE closing_id = ? ORDER BY id`, [closingId]).map(toRow)

/** حفظ الشهر بأرقامه وقت التقفيل */
export function insertClosing(ws: number, c: MonthlyClosing, closedAt: string, notes: string | null): number {
  const id = execute(
    `INSERT INTO month_closings(workspace_id, month, closed_at, sales_count, sales_total, sales_returns, profit, expenses, net_profit, notes)
     VALUES (@ws, @month, @closed_at, @sales_count, @sales_total, @sales_returns, @profit, @expenses, @net_profit, @notes)`,
    {
      ws,
      month: c.month,
      closed_at: closedAt,
      sales_count: c.sales.count,
      sales_total: c.sales.total,
      sales_returns: c.sales.returns,
      profit: c.profit,
      expenses: c.expenses,
      net_profit: c.net_profit,
      notes
    }
  )
  for (const r of c.rows) {
    execute(
      `INSERT INTO month_closing_partners(closing_id, ${PARTNER_COLUMNS})
       VALUES (@closing_id, @partner_id, @partner_name, @share_percent, @opening, @profit_share, @sold, @paid_out, @settled, @closing, @capital)`,
      {
        closing_id: id,
        partner_id: r.partner.id,
        partner_name: r.partner.name,
        share_percent: r.partner.share_percent,
        opening: r.opening,
        profit_share: r.profit_share,
        sold: r.sold,
        paid_out: r.paid_out,
        settled: r.settled,
        closing: r.closing,
        capital: r.capital
      }
    )
  }
  return id
}

export const removeClosing = (id: number) => void execute('DELETE FROM month_closings WHERE id = ?', [id])
