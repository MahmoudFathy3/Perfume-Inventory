import type { DashboardRange, PartnerLedger, PartnerPaymentInput, PartnerSales } from '@shared/types'
import { AppError, positiveAmount, round2, today } from '../../lib/errors'
import { activeWorkspaceId, PERSONAL_WORKSPACE_ID } from '../../lib/workspace'
import { lifetimeProfit } from '../dashboard/dashboard.service'
import * as workspaces from '../workspaces/workspaces.repository'
import * as repo from './partners.repository'

/** الشراكة اللي شغالين عليها (حسابات الشركاء ملهاش معنى في المخزون الفعلي) */
function currentPartnership(): number {
  const id = activeWorkspaceId()
  if (id === PERSONAL_WORKSPACE_ID) throw new AppError('PERSONAL_WORKSPACE')
  return id
}

/**
 * كشف حساب الشركاء في الشراكة النشطة.
 * المستحق للشريك = نصيبه من الربح + اللي باعه للشراكة - اللي اتسوّى.
 * (رأس المال بيتعرض لوحده علشان بيرجع للشريك في التصفية مش مع الأرباح.)
 */
export function ledger(): PartnerLedger {
  const ws = currentPartnership()
  const profit = round2(lifetimeProfit())
  const totals = new Map(repo.totals(ws).map((t) => [t.partner_id, t]))

  const accounts = workspaces.findPartners(ws).map((partner) => {
    const t = totals.get(partner.id)!
    const profit_share = round2((profit * partner.share_percent) / 100)
    return {
      partner,
      capital: round2(t.capital),
      sold: round2(t.sold),
      profit_share,
      settled: round2(t.settled),
      balance: round2(profit_share + t.sold - t.settled)
    }
  })
  return { profit, accounts, payments: repo.findPayments(ws) }
}

/** تسوية: الشراكة بتدفع للشريك (to_partner) أو الشريك بيدفع للشراكة (from_partner) */
export function addPayment(input: PartnerPaymentInput): number {
  const ws = currentPartnership()
  if (!workspaces.findPartners(ws).some((p) => p.id === Number(input.partner_id))) throw new AppError('PARTNER_NOT_FOUND')
  if (input.direction !== 'to_partner' && input.direction !== 'from_partner') throw new AppError('INVALID_TYPE')
  const amount = positiveAmount(input.amount)
  return repo.insertPayment({
    workspace_id: ws,
    partner_id: Number(input.partner_id),
    amount: input.direction === 'to_partner' ? amount : -amount,
    payment_date: input.payment_date || today(),
    notes: input.notes?.trim() || null
  })
}

export const removePayment = ({ id }: { id: number }): void => repo.removePayment(id, currentPartnership())

/**
 * مبيعات كل شريك في الشراكة النشطة (من / إلى اختياري). الصافي = الإجمالي - المرتجع.
 * لو فيه فواتير من غير شريك (قبل الميزة دي) بتظهر في صف آخر partner_id = null.
 */
export function partnerSales({ from, to }: Partial<DashboardRange> = {}): PartnerSales[] {
  const ws = currentPartnership()
  const rows = new Map(repo.salesByPartner(ws, from || null, to || null).map((r) => [r.partner_id, r]))
  const row = (partner_id: number | null, partner_name: string | null): PartnerSales => {
    const r = rows.get(partner_id)
    const total = r?.total ?? 0
    const returns_total = r?.returns_total ?? 0
    return { partner_id, partner_name, invoices: r?.invoices ?? 0, total, returns_total, net: round2(total - returns_total), paid: r?.paid ?? 0 }
  }
  const result = workspaces.findPartners(ws).map((p) => row(p.id, p.name))
  if (rows.has(null)) result.push(row(null, null))
  return result
}
