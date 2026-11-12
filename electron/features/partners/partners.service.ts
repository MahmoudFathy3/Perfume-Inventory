import type { CustomerSummary, DashboardRange, PartnerAccount, PartnerLedger, PartnerPaymentInput, PartnerSales, PartnerStatement, PartnerTransferInput } from '@shared/types'
import { AppError, positiveAmount, round2, today } from '../../lib/errors'
import { assertOpen, assertPartnerPaymentOpen } from '../../lib/monthLock'
import { getDb } from '../../database/connection'
import { activeWorkspaceId, PERSONAL_WORKSPACE_ID, withWorkspace } from '../../lib/workspace'
import * as customers from '../customers/customers.repository'
import { lifetimeProfit, summary as dashboardSummary } from '../dashboard/dashboard.service'
import * as workspaces from '../workspaces/workspaces.repository'
import { linkPartnerCustomers } from '../workspaces/workspaces.service'
import * as closingRepo from './closing.repository'
import * as repo from './partners.repository'

/** الشراكة اللي شغالين عليها (حسابات الشركاء ملهاش معنى في المخزون الفعلي) */
function currentPartnership(): number {
  const id = activeWorkspaceId()
  if (id === PERSONAL_WORKSPACE_ID) throw new AppError('PERSONAL_WORKSPACE')
  return id
}

/**
 * كشف حساب الشركاء في الشراكة النشطة.
 * المستحق للشريك = نصيبه من الربح + اللي باعه للشراكة + اللي دفعه من جيبه في مشتريات الشراكة - اللي اتسوّى.
 * (رأس المال بيتعرض لوحده علشان بيرجع للشريك في التصفية مش مع الأرباح.)
 * ومع كل شريك حسابه كعميل في المخزون الفعلي (اللي أخده من المخزون الفعلي لنفسه).
 */
export function ledger(): PartnerLedger {
  const ws = currentPartnership()
  // الشراكات القديمة (قبل الربط): الشريك بيتربط بعميله أول ما الحسابات تتفتح
  getDb().transaction(() => linkPartnerCustomers(ws))()
  const storeAccounts = new Map(withWorkspace(PERSONAL_WORKSPACE_ID, () => customers.findAll()).map((c) => [c.id, c]))
  const profit = round2(lifetimeProfit())
  const totals = new Map(repo.totals(ws).map((t) => [t.partner_id, t]))
  const unpaid = closingRepo.unpaidSaleTransfers(ws, '9999-12-31')

  const accounts = workspaces.findPartners(ws).map((partner) => {
    const t = totals.get(partner.id)!
    const mine = unpaid.filter((u) => u.partner_id === partner.id)
    const unpaidSum = (into: number) => round2(mine.filter((u) => u.into_ws === into).reduce((sum, u) => sum + u.remaining, 0))
    const profit_share = round2((profit * partner.share_percent) / 100)
    return {
      partner,
      capital: round2(t.capital),
      sold: round2(t.sold),
      // التسوية بين الشريكين بتتعرض في "دفعه من جيبه" (اللي دفعه لشريكه بيزيد، واللي استلمه بيقل) مش في "اتدفع فعلًا"، والباقي زي ما هو
      paid_out: round2(t.paid_out - t.pair_net),
      profit_share,
      settled: round2(t.settled - t.pair_net),
      balance: round2(profit_share + t.sold + t.paid_out - t.settled),
      unpaid_transfers: { owed_to: unpaidSum(1), owed_by: unpaidSum(0) },
      store_account: storeAccountOf(partner.customer_id, storeAccounts)
    }
  })
  return { profit, accounts, payments: repo.findPayments(ws) }
}

/**
 * كشف حساب شريك واحد بالتفصيل: نفس أرقام الجدول ومعاها حساب نصيب الربح خطوة بخطوة والحركات اللي كوّنت كل بند.
 * مجموع كل بند في الحركات = نفس الرقم اللي في الجدول.
 */
export function statement({ partner_id }: { partner_id: number }): PartnerStatement {
  const ws = currentPartnership()
  const account = ledger().accounts.find((a) => a.partner.id === Number(partner_id))
  if (!account) throw new AppError('PARTNER_NOT_FOUND')
  const all = dashboardSummary()
  return {
    account,
    profit: { actual: all.profit, expenses: all.expenses.deducted, net: all.net_profit, share_percent: account.partner.share_percent },
    lines: repo.statementLines(ws, account.partner.id)
  }
}

function storeAccountOf(customerId: number | null, accounts: Map<number, CustomerSummary>): PartnerAccount['store_account'] {
  const c = customerId ? accounts.get(customerId) : undefined
  return c ? { customer_id: c.id, sales_count: c.sales_count, total: c.total, paid: c.paid, remaining: c.remaining } : null
}

/**
 * تسوية: الشراكة بتدفع للشريك (to_partner) أو الشريك بيدفع للشراكة (from_partner).
 * apply_to_transfers: المبلغ يروح الأول لتحويلات "بيع بسعر" اللي لسه ما اتدفعتش في نفس الاتجاه (الأقدم الأول) كدفعات تحويل،
 * فتتعلّم مدفوعة ومحدش يدفعها تاني بعدين، والباقي تسوية عادية. بيرجّع رقم آخر دفعة.
 */
export const addPayment = (input: PartnerPaymentInput): number =>
  getDb().transaction(() => {
    const ws = currentPartnership()
    const partnerId = Number(input.partner_id)
    if (!workspaces.findPartners(ws).some((p) => p.id === partnerId)) throw new AppError('PARTNER_NOT_FOUND')
    if (input.direction !== 'to_partner' && input.direction !== 'from_partner') throw new AppError('INVALID_TYPE')
    let left = positiveAmount(input.amount)
    const date = input.payment_date || today()
    assertOpen(date, [ws])
    const sign = input.direction === 'to_partner' ? 1 : -1
    const notes = input.notes?.trim() || null
    const pay = (amount: number, transferId: number | null = null) =>
      repo.insertPayment({ workspace_id: ws, partner_id: partnerId, amount: sign * amount, payment_date: date, notes, transfer_id: transferId })

    let id = 0
    if (input.apply_to_transfers) {
      // to_partner = تحويلات دخلت الشراكة منه (الشراكة عليها له)، from_partner = تحويلات خرجت له (هو عليه)
      const transfers = closingRepo.unpaidSaleTransfers(ws, date).filter((t) => t.partner_id === partnerId && t.into_ws === (sign === 1 ? 1 : 0))
      for (const t of transfers) {
        if (left <= 0.005) break
        const part = round2(Math.min(left, t.remaining))
        id = pay(part, t.id)
        left = round2(left - part)
      }
    }
    if (left > 0.005) id = pay(left)
    return id
  })()

/**
 * تسوية بين الشريكين: from دفع لـ to من جيبه. بتتسجل كإن from دفع للشراكة والشراكة دفعت لـ to
 * (فاللي ليه بيقل عند to وبيزيد عند from بنفس المبلغ). الدفعتين مربوطين وبيتحذفوا مع بعض.
 */
export const transferBetweenPartners = (input: PartnerTransferInput): number =>
  getDb().transaction(() => {
    const ws = currentPartnership()
    const partners = workspaces.findPartners(ws)
    const from = partners.find((p) => p.id === Number(input.from_partner_id))
    const to = partners.find((p) => p.id === Number(input.to_partner_id))
    if (!from || !to) throw new AppError('PARTNER_NOT_FOUND')
    if (from.id === to.id) throw new AppError('DUPLICATE_PARTNERS')
    const amount = positiveAmount(input.amount)
    const date = input.payment_date || today()
    assertOpen(date, [ws])
    const notes = input.notes?.trim() || null
    const received = repo.insertPayment({ workspace_id: ws, partner_id: to.id, amount, payment_date: date, notes })
    const paid = repo.insertPayment({ workspace_id: ws, partner_id: from.id, amount: -amount, payment_date: date, notes })
    repo.setPair([received, paid], received)
    return received
  })()

export function removePayment({ id }: { id: number }): void {
  const ws = currentPartnership()
  assertPartnerPaymentOpen(id)
  repo.removePayment(id, ws)
}

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

// تقفيل الشهر في ملف لوحده (closing.service)
export { closedMonths, closedPartnerDays, closeMonth, dayPartnerClosing, monthlyClosing, reopenMonth, settleDay, settleMonth } from './closing.service'
