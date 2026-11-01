import { useTranslation } from 'react-i18next'
import type { DashboardSummary } from '@shared/types'
import { Card } from '@/shared/components/ui'
import { formatMoney } from '@/shared/utils/format'

/** رأس المال: قيمة المخزون الفعلي بسعر التكلفة (جديد + تالف)، ومعاها قيمته بسعر البيع والربح المتوقع */
export function CapitalCard({ stock }: { stock: DashboardSummary['stock'] }) {
  const { t, i18n } = useTranslation()
  const money = (v: number) => formatMoney(v, i18n.language)
  const parts = [
    { label: t('dashboard.capitalNew'), value: stock.new_cost_value },
    { label: t('dashboard.capitalDamaged'), value: stock.damaged_cost_value },
    { label: t('dashboard.stockSellingValue'), value: stock.selling_value },
    { label: t('dashboard.expectedProfit'), value: stock.expected_profit }
  ]
  return (
    <Card className="col-span-3 border-s-[5px] border-primary-600 bg-gradient-to-l from-primary-50 to-white">
      <p className="text-[13px] text-slate-500">{t('dashboard.capital')} — {t('dashboard.capitalSub')}</p>
      <strong className="my-1.5 block text-[34px] text-primary-700">{money(stock.cost_value)}</strong>
      <dl className="mt-2 grid grid-cols-4 gap-3 border-t border-slate-200 pt-3">
        {parts.map((p) => (
          <div key={p.label}>
            <dt className="text-xs text-slate-500">{p.label}</dt>
            <dd className="font-bold">{money(p.value)}</dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}
