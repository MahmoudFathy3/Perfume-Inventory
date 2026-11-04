/**
 * تقفيل الشهر في الشراكة.
 * - الشهر المفتوح: أرقامه بتتحسب من الفواتير والحركات نفسها، ومعاها اللي لسه عليه فلوس في الشهر.
 * - التقفيل: بيحتاج الشهر يكون خلص وكل حاجة فيه مدفوعة (فواتير البيع والشراء وتحويلات البيع بسعر).
 *   أرقام الشهر وحساب كل شريك بيتحفظوا، وأي حاجة بتاريخ في الشهر بتتقفل (lib/monthLock).
 * - فتح الشهر تاني: الأرقام المحفوظة بتتشال والتعديل بيرجع مسموح.
 */
import type { ClosedMonth, MonthlyClosing } from '@shared/types'
import { getDb, queryOne } from '../../database/connection'
import { AppError, round2, today } from '../../lib/errors'
import { activeWorkspaceId, PERSONAL_WORKSPACE_ID } from '../../lib/workspace'
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

/**
 * أرقام الشهر محسوبة من الحركات: لكل شريك الباقي له أول الشهر، ونصيبه من صافي ربح الشهر،
 * واللي باعه ودفعه من جيبه واللي اتسوّى في الشهر، والباقي له آخر الشهر.
 * الباقي آخر الشهر = نفس "الباقي" في حسابات الشركاء لو مفيش حركات بعد الشهر.
 */
function compute(ws: number, month: string): Omit<MonthlyClosing, 'closed' | 'unpaid' | 'ended'> {
  const from = `${month}-01`
  const to = lastDayOf(month)
  const period = { from, to }
  const opening = profitSummary({ from: null, to: dayBefore(from) }).net
  const current = profitSummary(period)
  const sales = dashboardRepo.sales(period)

  const inMonth = (date: string) => date >= from && date <= to
  const beforeMonth = (date: string) => date < from
  const sum = (lines: { date: string; amount: number }[], when: (date: string) => boolean) =>
    lines.reduce((total, l) => (when(l.date.slice(0, 10)) ? total + l.amount : total), 0)

  const rows = workspaces.findPartners(ws).map((partner) => {
    const lines = partnersRepo.statementLines(ws, partner.id)
    const share = (profit: number) => (profit * partner.share_percent) / 100
    const balanceOf = (when: (date: string) => boolean) => sum(lines.sold, when) + sum(lines.paid_out, when) - sum(lines.settled, when)
    const openingBalance = share(opening) + balanceOf(beforeMonth)
    const profitShare = share(current.net)
    return {
      partner: { id: partner.id, name: partner.name, share_percent: partner.share_percent },
      opening: round2(openingBalance),
      profit_share: round2(profitShare),
      sold: round2(sum(lines.sold, inMonth)),
      paid_out: round2(sum(lines.paid_out, inMonth)),
      settled: round2(sum(lines.settled, inMonth)),
      closing: round2(openingBalance + profitShare + balanceOf(inMonth)),
      capital: round2(sum(lines.capital, (date) => date <= to))
    }
  })

  return {
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
    const closedAt = queryOne<{ now: string }>("SELECT datetime('now','localtime') AS now")!.now
    repo.insertClosing(ws, { ...compute(ws, m), closed: null, unpaid: [], ended: true }, closedAt, notes?.trim() || null)
  })()

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
