import type { PartnerLedger, PartnerPaymentInput } from '@shared/types'
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
