import type { PartnerPayment } from '@shared/types'
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
    `SELECT pp.id, pp.partner_id, p.name AS partner_name, pp.amount, pp.payment_date, pp.notes
     FROM partner_payments pp JOIN workspace_partners p ON p.id = pp.partner_id
     WHERE pp.workspace_id = ? ORDER BY pp.payment_date DESC, pp.id DESC`,
    [workspaceId]
  )

export const insertPayment = (p: { workspace_id: number; partner_id: number; amount: number; payment_date: string; notes: string | null }) =>
  execute(
    'INSERT INTO partner_payments(workspace_id, partner_id, amount, payment_date, notes) VALUES (@workspace_id, @partner_id, @amount, @payment_date, @notes)',
    p
  )

export const removePayment = (id: number, workspaceId: number) =>
  void execute('DELETE FROM partner_payments WHERE id = ? AND workspace_id = ?', [id, workspaceId])
