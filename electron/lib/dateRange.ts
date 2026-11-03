import type { DateFilter } from '@shared/types'

/**
 * شرط الفترة على عمود تاريخ (من / إلى اختياري، شاملين اليومين):
 * dateClause('s.sale_date', { from: '2026-01-01' }) → { where: "AND s.sale_date >= @from", params: { from: '2026-01-01' } }
 * لو مفيش تاريخ بيرجّع شرط فاضي، فممكن يتحط بعد أي WHERE.
 */
export function dateClause(column: string, { from, to }: DateFilter = {}): { where: string; params: DateFilter } {
  const parts: string[] = []
  const params: DateFilter = {}
  if (from) {
    parts.push(`AND ${column} >= @from`)
    params.from = from
  }
  if (to) {
    parts.push(`AND ${column} <= @to`)
    params.to = to
  }
  return { where: parts.join(' '), params }
}

/** هل فيه فترة متحددة؟ */
export const hasRange = ({ from, to }: DateFilter = {}): boolean => !!(from || to)
