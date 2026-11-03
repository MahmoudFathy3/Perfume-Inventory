import type { PartnerPayment, PartnerSales } from '@shared/types'
import { salePaid } from '../../lib/salePaid'
import { execute, queryAll } from '../../database/connection'

export interface PartnerTotals {
  partner_id: number
  capital: number
  sold: number
  paid_out: number
  settled: number
  /** صافي التسويات بين الشريكين: موجب = استلم من شريكه، سالب = دفع لشريكه */
  pair_net: number
}

/**
 * مجاميع كل شريك في الشراكة:
 * capital = رأس المال الداخل - الخارج (بالتكلفة) | sold = المبيعات للشراكة - منها (بسعر التحويل)
 * paid_out = فواتير شراء للشراكة دفعها من جيبه (بعد مرتجعات الشراء) | settled = صافي التسويات.
 * "الداخل" = تحويل من المخزون الفعلي للشراكة، و"الخارج" = العكس.
 */
export const totals = (workspaceId: number) =>
  queryAll<PartnerTotals>(
    `SELECT p.id AS partner_id,
            COALESCE((SELECT SUM(CASE WHEN t.to_workspace_id = @ws THEN t.total_cost ELSE -t.total_cost END)
                      FROM transfers t WHERE t.partner_id = p.id AND t.kind = 'capital'), 0) AS capital,
            COALESCE((SELECT SUM(CASE WHEN t.to_workspace_id = @ws THEN t.total_price ELSE -t.total_price END)
                      FROM transfers t WHERE t.partner_id = p.id AND t.kind = 'sale'), 0) AS sold,
            COALESCE((SELECT SUM(pu.total - COALESCE((SELECT SUM(total) FROM returns WHERE purchase_id = pu.id), 0))
                      FROM purchases pu WHERE pu.partner_id = p.id AND pu.paid_by_partner = 1), 0) AS paid_out,
            COALESCE((SELECT SUM(amount) FROM partner_payments pp WHERE pp.partner_id = p.id), 0) AS settled,
            COALESCE((SELECT SUM(amount) FROM partner_payments pp WHERE pp.partner_id = p.id AND pp.pair_id IS NOT NULL), 0) AS pair_net
     FROM workspace_partners p WHERE p.workspace_id = @ws ORDER BY p.id`,
    { ws: workspaceId }
  )

export const findPayments = (workspaceId: number) =>
  queryAll<PartnerPayment>(
    `SELECT pp.id, pp.partner_id, p.name AS partner_name, pp.amount, pp.payment_date, pp.notes, pp.transfer_id, pp.pair_id,
            (SELECT op.name FROM partner_payments o JOIN workspace_partners op ON op.id = o.partner_id
             WHERE o.pair_id = pp.pair_id AND o.id != pp.id) AS counterparty_name
     FROM partner_payments pp JOIN workspace_partners p ON p.id = pp.partner_id
     WHERE pp.workspace_id = ? ORDER BY pp.payment_date DESC, pp.id DESC`,
    [workspaceId]
  )

export const insertPayment = (p: { workspace_id: number; partner_id: number; amount: number; payment_date: string; notes: string | null; transfer_id?: number | null }) =>
  execute(
    `INSERT INTO partner_payments(workspace_id, partner_id, amount, payment_date, notes, transfer_id)
     VALUES (@workspace_id, @partner_id, @amount, @payment_date, @notes, @transfer_id)`,
    { ...p, transfer_id: p.transfer_id ?? null }
  )

/** دفعات تحويل واحد (الأقدم الأول) */
export const findTransferPayments = (transferId: number) =>
  queryAll<PartnerPayment>(
    `SELECT pp.id, pp.partner_id, p.name AS partner_name, pp.amount, pp.payment_date, pp.notes, pp.transfer_id, pp.pair_id, NULL AS counterparty_name
     FROM partner_payments pp JOIN workspace_partners p ON p.id = pp.partner_id
     WHERE pp.transfer_id = ? ORDER BY pp.payment_date, pp.id`,
    [transferId]
  )

export const removeTransferPayments = (transferId: number) => void execute('DELETE FROM partner_payments WHERE transfer_id = ?', [transferId])

/** هل الدفعة على تحويل تلقائي لفاتورة بيع؟ (دي بتمشي مع الفاتورة ومبتتحذفش لوحدها) */
export const isSalePayment = (id: number): boolean =>
  queryAll('SELECT 1 FROM partner_payments pp JOIN transfers t ON t.id = pp.transfer_id WHERE pp.id = ? AND t.sale_id IS NOT NULL', [id]).length > 0

/** حذف تسوية. لو تبع تسوية بين الشريكين، الدفعتين بيتحذفوا مع بعض */
export const removePayment = (id: number, workspaceId: number) =>
  void execute(
    'DELETE FROM partner_payments WHERE workspace_id = @ws AND (id = @id OR (pair_id IS NOT NULL AND pair_id = (SELECT pair_id FROM partner_payments WHERE id = @id)))',
    { id, ws: workspaceId }
  )

export const setPair = (ids: number[], pairId: number) => void execute(`UPDATE partner_payments SET pair_id = ? WHERE id IN (${ids.map(() => '?').join(',')})`, [pairId, ...ids])

/**
 * مبيعات كل شريك في الفترة (بتاريخ الفاتورة): عدد الفواتير والإجمالي والمرتجع والصافي والمحصّل.
 * الفواتير القديمة اللي اتعملت قبل تحديد الشريك بتيجي في صف partner_id = NULL.
 */
export const salesByPartner = (workspaceId: number, from: string | null, to: string | null) =>
  queryAll<Omit<PartnerSales, 'partner_name'>>(
    `SELECT s.partner_id,
            COUNT(*) AS invoices,
            ROUND(SUM(s.total), 2) AS total,
            ROUND(SUM(COALESCE((SELECT SUM(total) FROM returns WHERE sale_id = s.id), 0)), 2) AS returns_total,
            ROUND(SUM(${salePaid('s.id')}), 2) AS paid
     FROM sales s
     WHERE s.workspace_id = @ws AND (@from IS NULL OR s.sale_date >= @from) AND (@to IS NULL OR s.sale_date <= @to)
     GROUP BY s.partner_id`,
    { ws: workspaceId, from, to }
  )
