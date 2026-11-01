import { useTranslation } from 'react-i18next'
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { formatNumber } from '@/shared/utils/format'
import { ChartCard } from './ChartCard'
import { ChartTooltip } from './ChartTooltip'
import { CHART_COLORS as C } from './chartTheme'

/** دائرة الجديد مقابل التالف (الحالي) وفي منتصفها إجمالي القطع */
export function StockConditionChart({ stock }: { stock: { new: number; damaged: number } }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const total = stock.new + stock.damaged
  const data = [
    { key: 'new' as const, name: t('condition.new'), value: stock.new },
    { key: 'damaged' as const, name: t('condition.damaged'), value: stock.damaged }
  ]
  return (
    <ChartCard title={t('dashboard.chartStock')} empty={total === 0}>
      <div className="relative">
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={65} outerRadius={95} paddingAngle={3} cornerRadius={6} stroke="none">
              {data.map((d) => (
                <Cell key={d.key} fill={C[d.key]} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip format={(v) => `${formatNumber(v, lang)} ${t('dashboard.pieces')}`} titleFormat={() => ''} />} />
            <Legend iconType="circle" />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-x-0 bottom-[34px] top-0 flex flex-col items-center justify-center">
          <strong className="text-[26px]">{formatNumber(total, lang)}</strong>
          <small className="text-slate-500">{t('dashboard.pieces')}</small>
        </div>
      </div>
    </ChartCard>
  )
}
