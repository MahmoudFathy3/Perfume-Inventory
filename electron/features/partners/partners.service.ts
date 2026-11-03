import type { CustomerSummary, DashboardRange, PartnerAccount, PartnerLedger, PartnerPaymentInput, PartnerSales, PartnerTransferInput } from '@shared/types'
import { AppError, positiveAmount, round2, today } from '../../lib/errors'
import { getDb } from '../../database/connection'
import { activeWorkspaceId, PERSONAL_WORKSPACE_ID, withWorkspace } from '../../lib/workspace'
import * as customers from '../customers/customers.repository'
import { lifetimeProfit } from '../dashboard/dashboard.service'
import * as workspaces from '../workspaces/workspaces.repository'
import { linkPartnerCustomers } from '../workspaces/workspaces.service'
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

  const accounts = workspaces.findPartners(ws).map((partner) => {
    const t = totals.get(partner.id)!
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
      store_account: storeAccountOf(partner.customer_id, storeAccounts)
    }
  })
  return { profit, accounts, payments: repo.findPayments(ws) }
}

function storeAccountOf(customerId: number | null, accounts: Map<number, CustomerSummary>): PartnerAccount['store_account'] {
  const c = customerId ? accounts.get(customerId) : undefined
  return c ? { customer_id: c.id, sales_count: c.sales_count, total: c.total, paid: c.paid, remaining: c.remaining } : null
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
    const notes = input.notes?.trim() || null
    const received = repo.insertPayment({ workspace_id: ws, partner_id: to.id, amount, payment_date: date, notes })
    const paid = repo.insertPayment({ workspace_id: ws, partner_id: from.id, amount: -amount, payment_date: date, notes })
    repo.setPair([received, paid], received)
    return received
  })()

export function removePayment({ id }: { id: number }): void {
  if (repo.isSalePayment(id)) throw new AppError('PAYMENT_FROM_SALE') // بتتشال لوحدها لو دفع الفاتورة اتغيّر
  repo.removePayment(id, currentPartnership())
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
