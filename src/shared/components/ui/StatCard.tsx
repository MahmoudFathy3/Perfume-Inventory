import clsx from 'clsx'
import type { ReactNode } from 'react'

export type StatTone = 'teal' | 'indigo' | 'green' | 'slate'

// لون الحافة + لون الرقم + خلفية البطاقة الكبيرة
const tones: Record<StatTone, { edge: string; value: string; big: string }> = {
  teal: { edge: 'border-primary-600', value: 'text-primary-700', big: 'bg-primary-50' },
  indigo: { edge: 'border-indigo-500', value: 'text-indigo-600', big: 'bg-indigo-50' },
  green: { edge: 'border-green-600', value: 'text-green-700', big: 'bg-green-50' },
  slate: { edge: 'border-slate-500', value: 'text-slate-700', big: 'bg-slate-50' }
}

interface StatCardProps {
  label: ReactNode
  value: ReactNode
  /** سطر صغير تحت الرقم */
  sub?: ReactNode
  tone?: StatTone
  big?: boolean
  className?: string
}

/** بطاقة رقم (الرئيسية وصفحة تفاصيل المنتج) */
export function StatCard({ label, value, sub, tone = 'slate', big = false, className }: StatCardProps) {
  const c = tones[tone]
  return (
    <div className={clsx('flex flex-col gap-2 rounded-2xl border-s-[5px] p-4 shadow-card', c.edge, big ? c.big : 'bg-surface', className)}>
      <span className="text-[13px] text-slate-500">{label}</span>
      <strong className={clsx(c.value, big ? 'text-[26px]' : 'text-[22px]')}>{value}</strong>
      {sub && <small className="text-xs text-slate-500">{sub}</small>}
    </div>
  )
}
