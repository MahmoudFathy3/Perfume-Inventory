/**
 * تقفيل الشهر في الشراكة.
 * - الشهر المفتوح: أرقامه بتتحسب من الفواتير والحركات نفسها، ومعاها اللي لسه عليه فلوس في الشهر.
 * - التقفيل: بيحتاج الشهر يكون خلص وكل حاجة فيه مدفوعة (فواتير البيع والشراء وتحويلات البيع بسعر).
 *   أرقام الشهر وحساب كل شريك بيتحفظوا، وأي حاجة بتاريخ في الشهر بتتقفل (lib/monthLock).
 * - فتح الشهر تاني: الأرقام المحفوظة بتتشال والتعديل بيرجع مسموح.
 */
import type { ClosedMonth, DailyReport, MonthlyClosing } from '@shared/types'
import { getDb, queryOne } from '../../database/connection'
import { AppError, round2, today } from '../../lib/errors'
import { assertOpen } from '../../lib/monthLock'
import { activeWorkspaceId, PERSONAL_WORKSPACE_ID } from '../../lib/workspace'
import * as dailyRepo from '../dailyClosing/dailyClosing.repository'
import * as dashboardRepo from '../dashboard/dashboard.repository'
import { profitSummary } from '../dashboard/dashboard.service'
import * as workspaces from '../workspaces/workspaces.repository'
import * as repo from './closing.repository'
import * as partnersRepo from './partners.repository'

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/

/** الشراكة النشطة (التقفيل ملوش معنى في المخزون الفعلي ولا المخزن الخارجي) */
function currentPartnership(): number {
  const id = activeWorkspaceId()
  if (id === PERSONAL_WORKSPACE_ID || workspaces.findById(id)?.kind !== 'partnership') throw new AppError('PERSONAL_WORKSPACE')
  return id
}

function checkMonth(month: unknown): string {
  if (typeof month !== 'string' || !MONTH.test(month)) throw new AppError('INVALID_MONTH')
  return month
}

/** آخر يوم في الشهر (YYYY-MM-DD) */
function lastDayOf(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`
}

/** اليوم اللي قبل تاريخ (YYYY-MM-DD) */
function dayBefore(date: string): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

/** حساب شهر (YYYY-MM) */
const compute = (ws: number, month: string) => computePeriod(ws, month, `${month}-01`, lastDayOf(month))

/**
 * أرقام فترة (شهر أو يوم) محسوبة من الحركات: لكل شريك الباقي له أول الفترة، ونصيبه من صافي ربحها،
 * واللي باعه ودفعه من جيبه واللي اتسوّى فيها، والباقي له آخرها.
 * الباقي آخر الفترة = نفس "الباقي" في حسابات الشركاء لو مفيش حركات بعدها.
 * key = الشهر (YYYY-MM) أو اليوم (YYYY-MM-DD).
 */
export function computePeriod(ws: number, key: string, from: string, to: string): Omit<MonthlyClosing, 'closed' | 'unpaid' | 'ended'> {
  const month = key
  const period = { from, to }
  const opening = profitSummary({ from: null, to: dayBefore(from) }).net
  const current = profitSummary(period)
  const sales = dashboardRepo.sales(period)

  const inMonth = (date: string) => date >= from && date <= to
  const beforeMonth = (date: string) => date < from
  const sum = (lines: { date: string; amount: number }[], when: (date: string) => boolean) =>
    lines.reduce((total, l) => (when(l.date.slice(0, 10)) ? total + l.amount : total), 0)

  const later = repo.laterTransferPayments(ws, to)
  const rows = workspaces.findPartners(ws).map((partner) => {
    const lines = partnersRepo.statementLines(ws, partner.id)
    const share = (profit: number) => (profit * partner.share_percent) / 100
    const balanceOf = (when: (date: string) => boolean) => sum(lines.sold, when) + sum(lines.paid_out, when) - sum(lines.settled, when)
    const openingBalance = share(opening) + balanceOf(beforeMonth)
    const profitShare = share(current.net)
    const closing = round2(openingBalance + profitShare + balanceOf(inMonth))
    return {
      due: round2(closing - (later.get(partner.id) ?? 0)),
      partner: { id: partner.id, name: partner.name, share_percent: partner.share_percent },
      opening: round2(openingBalance),
      profit_share: round2(profitShare),
      sold: round2(sum(lines.sold, inMonth)),
      paid_out: round2(sum(lines.paid_out, inMonth)),
      settled: round2(sum(lines.settled, inMonth)),
      closing,
      capital: round2(sum(lines.capital, (date) => date <= to))
    }
  })

  return {
    period: from === to ? 'day' : 'month',
    month,
    from,
    to,
    sales: { count: sales.count, total: round2(sales.products), returns: round2(dashboardRepo.returnsOf('sale', period).total) },
    profit: round2(current.profit),
    expenses: round2(current.expenses),
    net_profit: round2(current.net),
    rows
  }
}

/** تقفيل شهر: لو مقفول بيرجع أرقامه المحفوظة، ولو مفتوح بيحسبها ومعاها اللي لسه عليه فلوس */
export function monthlyClosing({ month }: { month: string }): MonthlyClosing {
  const ws = currentPartnership()
  const m = checkMonth(month)
  const to = lastDayOf(m)
  const ended = today() >= to
  const saved = repo.findClosing(ws, m)
  if (saved) {
    return {
      period: 'month',
      month: m,
      from: `${m}-01`,
      to,
      sales: { count: saved.sales_count, total: saved.sales_total, returns: saved.sales_returns },
      profit: saved.profit,
      expenses: saved.expenses,
      net_profit: saved.net_profit,
      rows: repo.findClosingRows(saved.id),
      closed: { closed_at: saved.closed_at, notes: saved.notes },
      unpaid: [],
      ended
    }
  }
  return { ...compute(ws, m), closed: null, unpaid: repo.unpaid(ws, m), ended }
}

/**
 * قفل الشهر: لازم يكون خلص وكل حاجة فيه مدفوعة. أرقامه بتتحفظ زي ما هي،
 * وبعد كده أي حاجة بتاريخ في الشهر مبتتضافش ولا تتعدّل ولا تتحذف (MONTH_CLOSED).
 */
export const closeMonth = ({ month, notes }: { month: string; notes?: string }): void =>
  getDb().transaction(() => {
    const ws = currentPartnership()
    const m = checkMonth(month)
    if (repo.findClosing(ws, m)) throw new AppError('MONTH_ALREADY_CLOSED')
    if (today() < lastDayOf(m)) throw new AppError('MONTH_NOT_ENDED')
    if (repo.unpaid(ws, m).length > 0) throw new AppError('MONTH_HAS_UNPAID')
    const computed = compute(ws, m)
    // لازم الأول يتسوّى حساب كل الشركاء (الباقي آخر الشهر = صفر)
    if (computed.rows.some((r) => Math.abs(r.due ?? r.closing) >= 0.005)) throw new AppError('MONTH_NOT_SETTLED')
    const closedAt = queryOne<{ now: string }>("SELECT datetime('now','localtime') AS now")!.now
    repo.insertClosing(ws, { ...computed, closed: null, unpaid: [], ended: true }, closedAt, notes?.trim() || null)
  })()

/**
 * تسوية الكل: كل شريك بياخد الباقي له كله آخر الشهر (أو بيدفع اللي عليه)، بتاريخ آخر يوم في الشهر (أو النهارده لو لسه ما خلصش):
 * 1. تحويلات "بيع بسعر" اللي لسه ما اتدفعتش بتتدفع كدفعات تحويل (فبتتعلّم مدفوعة، ومحدش يدفعها تاني بعدين).
 * 2. الباقي بعدها بيتسجل تسوية عادية (موجب = الشراكة دفعت له، سالب = هو دفع للشراكة).
 * بعدها الباقي آخر الشهر لكل شريك = صفر. بيرجّع اللي اتسوّى لكل شريك (مجموع الاتنين).
 */
export const settleMonth = ({ month, notes }: { month: string; notes?: string }): { partner_id: number; amount: number }[] =>
  getDb().transaction(() => {
    const ws = currentPartnership()
    const m = checkMonth(month)
    if (repo.findClosing(ws, m)) throw new AppError('MONTH_CLOSED')
    const end = lastDayOf(m)
    const date = end < today() ? end : today()
    if (date < `${m}-01`) throw new AppError('MONTH_NOT_ENDED') // شهر لسه ما بدأش
    assertOpen(date, [ws])
    return settleAll(ws, date, () => compute(ws, m).rows, notes)
  })()

/**
 * التسويات نفسها (للشهر أو اليوم) بتاريخ date: تحويلات البيع اللي ما اتدفعتش لحد date كدفعات تحويل،
 * وبعدها الباقي لكل شريك (rows بتتحسب بعد دفع التحويلات) تسوية عادية
 */
function settleAll(ws: number, date: string, rows: () => MonthlyClosing['rows'], notes?: string): { partner_id: number; amount: number }[] {
  const text = String(notes ?? '').trim() || null
  const totals = new Map<number, number>()
  const pay = (partnerId: number, amount: number, transferId: number | null = null) => {
    partnersRepo.insertPayment({ workspace_id: ws, partner_id: partnerId, amount, payment_date: date, notes: text, transfer_id: transferId })
    totals.set(partnerId, round2((totals.get(partnerId) ?? 0) + amount))
  }
  for (const t of repo.unpaidSaleTransfers(ws, date)) pay(t.partner_id, t.into_ws ? t.remaining : -t.remaining, t.id)
  // due = الباقي − التحويلات اللي اتدفعت بعد الفترة (الحساب لحد آخرها لسه شايفها ليه، بس هو خدها خلاص)
  for (const r of rows()) if (Math.abs(r.due ?? r.closing) >= 0.005) pay(r.partner.id, r.due ?? r.closing)
  if (totals.size === 0) throw new AppError('NOTHING_TO_SETTLE')
  return [...totals].map(([partner_id, amount]) => ({ partner_id, amount }))
}

/** فتح شهر مقفول تاني (لو فيه غلط لازم يتصلّح): الأرقام المحفوظة بتتشال والتعديل بيرجع مسموح */
export function reopenMonth({ month }: { month: string }): void {
  const ws = currentPartnership()
  const saved = repo.findClosing(ws, checkMonth(month))
  if (!saved) throw new AppError('MONTH_NOT_CLOSED')
  repo.removeClosing(saved.id)
}

/** الشهور المقفولة في الشراكة النشطة (الأحدث الأول): كل شريك خد كام وفضل له كام في كل شهر */
export function closedMonths(): ClosedMonth[] {
  const ws = currentPartnership()
  return repo.findClosings(ws).map((c) => ({
    month: c.month,
    closed_at: c.closed_at,
    notes: c.notes,
    sales_total: c.sales_total,
    net_profit: c.net_profit,
    rows: c.rows
  }))
}

// ---------- التقفيل اليومي في حسابات الشركاء (نفس تقفيل الشهر ليوم واحد) ----------
// القفل نفسه هو قفل اليوم بتاع التقفيل اليومي (day_closings): اليوم بيتقفل مرة واحدة،
// وتقريره المحفوظ فيه حساب كل شريك (partners).

/** YYYY-MM-DD لتاريخ حقيقي */
function checkDay(day: unknown): string {
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new AppError('INVALID_DATE')
  const parsed = new Date(`${day}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== day) throw new AppError('INVALID_DATE')
  return day
}

/** صافي ربح اليوم من تقريره المحفوظ: الربح − المصروفات اللي بتتخصم */
const savedNet = (report: DailyReport) => round2(report.totals.profit - report.expenses.filter((e) => e.deduct).reduce((sum, e) => sum + e.amount, 0))

/** تقفيل يوم في الشراكة: لو مقفول بيرجع حساب الشركاء المحفوظ، ولو مفتوح بيحسبه */
export function dayPartnerClosing({ day }: { day: string }): MonthlyClosing {
  const ws = currentPartnership()
  const d = checkDay(day)
  const ended = d <= today()
  const saved = dailyRepo.findClosing(ws, d)
  const live = computePeriod(ws, d, d, d)
  // اليوم المفتوح: فواتير اليوم اللي لسه عليها فلوس (للعلم بس: اليوم بيتقفل وفيه آجل، بس ربحها داخل في نصيب الشركاء)
  if (!saved) return { ...live, closed: null, unpaid: repo.unpaid(ws, d), ended }
  const report = JSON.parse(saved.report) as DailyReport
  const deducted = report.expenses.filter((e) => e.deduct).reduce((sum, e) => sum + e.amount, 0)
  return {
    ...live,
    sales: { count: report.totals.sales_count, total: report.totals.sales_total, returns: report.totals.returns_total },
    profit: report.totals.profit,
    expenses: round2(deducted),
    net_profit: savedNet(report),
    // يوم اتقفل من صفحة التقفيل اليومي قبل ما حساب الشركاء يتحفظ معاه: بنعرض المحسوب
    rows: report.partners ?? live.rows,
    closed: { closed_at: saved.closed_at, notes: saved.notes },
    unpaid: [],
    ended
  }
}

/** تسوية الكل ليوم: كل شريك بياخد الباقي له آخر اليوم (أو بيدفع اللي عليه) بتاريخ اليوم ده */
export const settleDay = ({ day, notes }: { day: string; notes?: string }): { partner_id: number; amount: number }[] =>
  getDb().transaction(() => {
    const ws = currentPartnership()
    const d = checkDay(day)
    if (d > today()) throw new AppError('DAY_NOT_ENDED')
    assertOpen(d, [ws]) // اليوم أو شهره مقفول = DAY_CLOSED / MONTH_CLOSED
    return settleAll(ws, d, () => computePeriod(ws, d, d, d).rows, notes)
  })()

/** آخر الأيام المقفولة في الشراكة (الأحدث الأول): كل شريك خد كام وفضل له كام في كل يوم */
export function closedPartnerDays(): ClosedMonth[] {
  const ws = currentPartnership()
  return dailyRepo.findClosings(ws, 60).map((c) => {
    const report = JSON.parse(c.report) as DailyReport
    return { month: c.day, closed_at: c.closed_at, notes: c.notes, sales_total: report.totals.sales_total, net_profit: savedNet(report), rows: report.partners ?? [] }
  })
}
