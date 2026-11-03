import type { PartnerPayment, PartnerSales } from '@shared/types'
import { execute, queryAll } from '../../database/connection'

export interface PartnerTotals {
  partner_id: number
  capital: number
  sold: number
  settled: number
}

/**
 * مجاميع كل شريك في الشراكة:
 * capital = رأس المال الداخل - الخارج (بالتكلفة) | sold = المبيعات للشراكة - منها (بسعر التحويل) | settled = صافي التسويات.
 * "الداخل" = تحويل من المخزون الفعلي للشراكة، و"الخارج" = العكس.
 */
export const totals = (workspaceId: number) =>
  queryAll<PartnerTotals>(
    `SELECT p.id AS partner_id,
            COALESCE((SELECT SUM(CASE WHEN t.to_workspace_id = @ws THEN t.total_cost ELSE -t.total_cost END)
                      FROM transfers t WHERE t.partner_id = p.id AND t.kind = 'capital'), 0) AS capital,
            COALESCE((SELECT SUM(CASE WHEN t.to_workspace_id = @ws THEN t.total_price ELSE -t.total_price END)
                      FROM transfers t WHERE t.partner_id = p.id AND t.kind = 'sale'), 0) AS sold,
            COALESCE((SELECT SUM(amount) FROM partner_payments pp WHERE pp.partner_id = p.id), 0) AS settled
     FROM workspace_partners p WHERE p.workspace_id = @ws ORDER BY p.id`,
    { ws: workspaceId }
  )

export const findPayments = (workspaceId: number) =>
  queryAll<PartnerPayment>(
    `SELECT pp.id, pp.partner_id, p.name AS partner_name, pp.amount, pp.payment_date, pp.notes, pp.transfer_id
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
    `SELECT pp.id, pp.partner_id, p.name AS partner_name, pp.amount, pp.payment_date, pp.notes, pp.transfer_id
     FROM partner_payments pp JOIN workspace_partners p ON p.id = pp.partner_id
     WHERE pp.transfer_id = ? ORDER BY pp.payment_date, pp.id`,
    [transferId]
  )

export const removeTransferPayments = (transferId: number) => void execute('DELETE FROM partner_payments WHERE transfer_id = ?', [transferId])

/** هل الدفعة على تحويل تلقائي لفاتورة بيع؟ (دي بتمشي مع الفاتورة ومبتتحذفش لوحدها) */
export const isSalePayment = (id: number): boolean =>
  queryAll('SELECT 1 FROM partner_payments pp JOIN transfers t ON t.id = pp.transfer_id WHERE pp.id = ? AND t.sale_id IS NOT NULL', [id]).length > 0

export const removePayment = (id: number, workspaceId: number) =>
  void execute('DELETE FROM partner_payments WHERE id = ? AND workspace_id = ?', [id, workspaceId])

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
            ROUND(SUM(COALESCE((SELECT SUM(amount) FROM sale_payments WHERE sale_id = s.id), 0)), 2) AS paid
     FROM sales s
     WHERE s.workspace_id = @ws AND (@from IS NULL OR s.sale_date >= @from) AND (@to IS NULL OR s.sale_date <= @to)
     GROUP BY s.partner_id`,
    { ws: workspaceId, from, to }
  )
