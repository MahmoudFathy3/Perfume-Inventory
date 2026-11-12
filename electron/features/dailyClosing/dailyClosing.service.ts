/**
 * التقفيل اليومي (المخزون الفعلي والشراكات، كل مخزن لوحده):
 * - تقرير اليوم: الإجماليات (مبيعات، مرتجعات، ربح، تحصيل، موردين، مصروفات، صافي الكاش)،
 *   وكل شريك عمل إيه بالتفصيل (فواتيره ومرتجعاتها ومشترياته واللي خده). في المخزون الفعلي كله للمحل.
 * - القفل: التقرير بيتحفظ زي ما هو، وأي حاجة بتاريخ اليوم ده بتترفض (DAY_CLOSED) لحد ما يتفتح تاني.
 *   التحصيل في يوم تاني على فاتورة من اليوم ده مسموح (اليوم ممكن يتقفل وفيه آجل).
 */
import type { ClosedDay, DailyClosing, DailyReport, DayGroup } from '@shared/types'
import { AppError, round2, today } from '../../lib/errors'
import { activeWorkspaceId } from '../../lib/workspace'
import * as dashboardRepo from '../dashboard/dashboard.repository'
import { profitSummary } from '../dashboard/dashboard.service'
import { computePeriod } from '../partners/closing.service'
import * as workspaces from '../workspaces/workspaces.repository'
import * as repo from './dailyClosing.repository'

/** المخزن النشط لازم يكون المخزون الفعلي أو شراكة */
function currentStore(): { ws: number; partnership: boolean } {
  const ws = activeWorkspaceId()
  const kind = workspaces.findById(ws)?.kind
  if (kind !== 'personal' && kind !== 'partnership') throw new AppError('STORE_ONLY')
  return { ws, partnership: kind === 'partnership' }
}

/** YYYY-MM-DD لتاريخ حقيقي */
function checkDay(day: unknown): string {
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new AppError('INVALID_DATE')
  const parsed = new Date(`${day}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== day) throw new AppError('INVALID_DATE')
  return day
}

const sum = <T>(rows: T[], value: (row: T) => number) => round2(rows.reduce((total, row) => total + value(row), 0))

function group(kind: DayGroup['kind'], partner: DayGroup['partner'], parts: Pick<DayGroup, 'sales' | 'returns' | 'purchases' | 'settlements'>): DayGroup {
  return {
    kind,
    partner,
    ...parts,
    sales_total: sum(parts.sales, (s) => s.total),
    returns_total: sum(parts.returns, (r) => r.total),
    purchases_total: sum(parts.purchases, (p) => p.total),
    taken: sum(parts.settlements, (s) => s.amount)
  }
}

const strip = <T extends { partner_id?: unknown; joint?: unknown }>(rows: T[]) => rows.map(({ partner_id: _, joint: __, ...rest }) => rest)

/** تقرير اليوم محسوب من الحركات */
function compute(ws: number, partnership: boolean, day: string): DailyReport {
  const p = { ws, day }
  const range = { from: day, to: day }
  const sales = repo.sales(p)
  const returns = repo.returns(p)
  const purchases = repo.purchases(p)
  const settlements = partnership ? repo.settlements(p) : []
  const expenses = repo.expenses(p)

  let groups: DayGroup[]
  if (!partnership) {
    groups = [group('store', null, { sales: strip(sales), returns: strip(returns), purchases: strip(purchases), settlements: [] })]
  } else {
    // كل شريك ليه جدوله حتى لو ما عملش حاجة (علشان يبان)، وبعدهم المشتريات مع بعض والفواتير القديمة من غير شريك
    groups = workspaces.findPartners(ws).map((partner) =>
      group('partner', { id: partner.id, name: partner.name }, {
        sales: strip(sales.filter((s) => s.partner_id === partner.id)),
        returns: strip(returns.filter((r) => r.partner_id === partner.id)),
        purchases: strip(purchases.filter((x) => !x.joint && x.partner_id === partner.id)),
        settlements: strip(settlements.filter((s) => s.partner_id === partner.id))
      })
    )
    const joint = purchases.filter((x) => x.joint)
    if (joint.length > 0) groups.push(group('joint', null, { sales: [], returns: [], purchases: strip(joint), settlements: [] }))
    const unassigned = { sales: sales.filter((s) => s.partner_id === null), returns: returns.filter((r) => r.partner_id === null) }
    if (unassigned.sales.length + unassigned.returns.length > 0) {
      groups.push(group('unassigned', null, { sales: strip(unassigned.sales), returns: strip(unassigned.returns), purchases: [], settlements: [] }))
    }
  }

  const totals = dashboardRepo.sales(range)
  const returnsTotal = dashboardRepo.returnsOf('sale', range).total
  const collected = dashboardRepo.collected(range)
  const supplierPayments = repo.supplierPayments(p)
  const expensesTotal = sum(expenses, (e) => e.amount)
  return {
    day,
    totals: {
      sales_count: totals.count,
      sales_total: round2(totals.products),
      returns_total: round2(returnsTotal),
      net_sales: round2(totals.products - returnsTotal),
      profit: round2(profitSummary(range).profit),
      collected: round2(collected),
      supplier_payments: round2(supplierPayments),
      expenses: expensesTotal,
      net_cash: round2(collected - supplierPayments - expensesTotal)
    },
    groups,
    expenses,
    ...(partnership ? { partners: computePeriod(ws, day, day, day).rows } : {})
  }
}

/** تقرير يوم: لو مقفول بيرجع المحفوظ، ولو مفتوح بيتحسب */
export function dailyClosing({ day }: { day: string }): DailyClosing {
  const { ws, partnership } = currentStore()
  const d = checkDay(day)
  const can_close = d <= today()
  const saved = repo.findClosing(ws, d)
  if (saved) return { ...(JSON.parse(saved.report) as DailyReport), closed: { closed_at: saved.closed_at, notes: saved.notes }, can_close }
  return { ...compute(ws, partnership, d), closed: null, can_close }
}

/**
 * قفل اليوم: تقريره بيتحفظ، وبعد كده مفيش إضافة ولا تعديل ولا حذف لأي حاجة بتاريخه.
 * في الشراكة لازم الأول يتسوّى حساب كل الشركاء (الباقي آخر اليوم = صفر لكل شريك)، وإلا DAY_NOT_SETTLED.
 */
export function closeDay({ day, notes }: { day: string; notes?: string }): void {
  const { ws, partnership } = currentStore()
  const d = checkDay(day)
  if (d > today()) throw new AppError('DAY_NOT_ENDED')
  if (repo.findClosing(ws, d)) throw new AppError('DAY_ALREADY_CLOSED')
  const report = compute(ws, partnership, d)
  if (report.partners?.some((p) => Math.abs(p.due ?? p.closing) >= 0.005)) throw new AppError('DAY_NOT_SETTLED')
  repo.insertClosing(ws, d, report, String(notes ?? '').trim() || null)
}

/** فتح يوم مقفول تاني (لو فيه غلط): التقرير المحفوظ بيتشال والتعديل بيرجع مسموح */
export function reopenDay({ day }: { day: string }): void {
  const { ws } = currentStore()
  const saved = repo.findClosing(ws, checkDay(day))
  if (!saved) throw new AppError('DAY_NOT_CLOSED')
  repo.removeClosing(saved.id)
}

/** آخر الأيام المقفولة في المخزن النشط (الأحدث الأول) */
export function closedDays({ limit = 60 }: { limit?: number } = {}): ClosedDay[] {
  const { ws } = currentStore()
  return repo.findClosings(ws, Math.min(Math.max(Number(limit) || 60, 1), 366)).map((c) => {
    const report = JSON.parse(c.report) as DailyReport
    return { day: c.day, closed_at: c.closed_at, notes: c.notes, sales_total: report.totals.sales_total, net_cash: report.totals.net_cash }
  })
}
