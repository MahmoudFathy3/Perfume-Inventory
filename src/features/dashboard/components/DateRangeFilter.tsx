import clsx from 'clsx'
import { useTranslation } from 'react-i18next'
import { Button, Card, Field, Input } from '@/shared/components/ui'
import { daysAgoString, monthStartString, todayString } from '@/shared/utils/format'

export interface DateRange {
  from: string
  to: string
}

/** فلتر الفترة: من تاريخ / إلى تاريخ + اختصارات سريعة */
export function DateRangeFilter({ range, onChange }: { range: DateRange; onChange: (range: DateRange) => void }) {
  const { t } = useTranslation()
  const today = todayString()

  const setFrom = (from: string) => onChange({ from, to: range.to && from > range.to ? from : range.to })
  const setTo = (to: string) => onChange({ to, from: range.from && to < range.from ? to : range.from })

  const presets: { key: string; value: DateRange }[] = [
    { key: 'filterToday', value: { from: today, to: today } },
    { key: 'filter7', value: { from: daysAgoString(6), to: today } },
    { key: 'filterMonth', value: { from: monthStartString(), to: today } },
    { key: 'filterAll', value: { from: '', to: '' } }
  ]
  const isActive = (v: DateRange) => v.from === range.from && v.to === range.to

  return (
    <Card className="flex flex-wrap items-end gap-3.5 !py-3.5">
      <Field label={t('common.from')} className="!mb-0">
        <Input type="date" value={range.from} onChange={(e) => setFrom(e.target.value)} />
      </Field>
      <Field label={t('common.to')} className="!mb-0">
        <Input type="date" value={range.to} onChange={(e) => setTo(e.target.value)} />
      </Field>
      <div className="ms-auto flex flex-wrap gap-1.5">
        {presets.map((p) => (
          <Button
            key={p.key}
            size="sm"
            className={clsx('rounded-full !px-3.5 !py-1.5', isActive(p.value) && '!border-primary-600 !bg-primary-600 font-semibold !text-white')}
            onClick={() => onChange(p.value)}
          >
            {t(`dashboard.${p.key}`)}
          </Button>
        ))}
      </div>
    </Card>
  )
}
