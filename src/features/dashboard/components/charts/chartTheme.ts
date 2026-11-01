/** ألوان الرسوم وتنسيقات الأرقام (في مكان واحد) */
export const CHART_COLORS = {
  sales: '#0d9488',
  purchases: '#6366f1',
  up: '#16a34a',
  down: '#e11d48',
  new: '#16a34a',
  damaged: '#f59e0b',
  grid: '#e2e8f0'
} as const

export const compactNumber = (v: number): string => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(v)

/** 2026-10-11 → 11/10  |  2026-10 → 10/2026 */
export function periodLabel(period: string): string {
  const p = period.split('-')
  return p.length === 3 ? `${p[2]}/${p[1]}` : `${p[1]}/${p[0]}`
}

export const percentChange = (current: number, previous: number): number | null =>
  previous ? ((current - previous) / Math.abs(previous)) * 100 : null
