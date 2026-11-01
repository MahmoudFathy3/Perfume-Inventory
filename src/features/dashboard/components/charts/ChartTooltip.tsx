import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { getLanguage } from '@/i18n/languages'

interface TooltipEntry {
  dataKey?: string | number
  name?: string | number
  value?: number | string
  color?: string
  fill?: string
  stroke?: string
  payload?: Record<string, number>
}

interface ChartTooltipProps {
  active?: boolean
  payload?: TooltipEntry[]
  label?: string
  format: (value: number) => string
  titleFormat?: (label: string) => string
  footer?: (row: Record<string, number>) => ReactNode
}

/** بطاقة التلميح بنفس شكل التطبيق (الاتجاه حسب لغة الواجهة) */
export function ChartTooltip({ active, payload, label, format, titleFormat, footer }: ChartTooltipProps) {
  const { i18n } = useTranslation()
  if (!active || !payload?.length) return null
  return (
    <div dir={getLanguage(i18n.language).dir} className="min-w-[150px] rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[13px] shadow-pop">
      <strong className="mb-1.5 block">{titleFormat ? titleFormat(String(label ?? '')) : label}</strong>
      {payload.map((p) => (
        <div key={String(p.dataKey)} className="flex items-center gap-2">
          <span className="inline-block h-[9px] w-[9px] rounded-full" style={{ background: p.color || p.fill || p.stroke }} />
          <span>{p.name}</span>
          <b className="ms-auto ps-4">{format(Number(p.value))}</b>
        </div>
      ))}
      {footer && p0(payload) && footer(p0(payload)!)}
    </div>
  )
}

const p0 = (payload: TooltipEntry[]) => payload[0]?.payload
