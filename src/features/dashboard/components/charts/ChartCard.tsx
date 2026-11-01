import clsx from 'clsx'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Card } from '@/shared/components/ui'

interface ChartCardProps {
  title: string
  extra?: ReactNode
  empty?: boolean
  wide?: boolean
  children: ReactNode
}

/** إطار موحّد لأي رسم: عنوان + (شارة اختيارية) + الرسم. الرسم دايمًا LTR (الأرقام والتواريخ). */
export function ChartCard({ title, extra, empty, wide, children }: ChartCardProps) {
  const { t } = useTranslation()
  return (
    <Card className={clsx('min-w-0', wide && 'col-span-full')}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h3>{title}</h3>
        {extra}
      </div>
      {empty ? <p className="py-14 text-center text-slate-500">{t('dashboard.noChartData')}</p> : <div dir="ltr" className="text-xs">{children}</div>}
    </Card>
  )
}
