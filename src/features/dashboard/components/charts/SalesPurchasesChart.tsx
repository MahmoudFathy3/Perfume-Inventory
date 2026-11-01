import { useTranslation } from 'react-i18next'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ChartPoint } from '@shared/types'
import { formatMoney } from '@/shared/utils/format'
import { ChartCard } from './ChartCard'
import { ChartTooltip } from './ChartTooltip'
import { CHART_COLORS as C, compactNumber, periodLabel } from './chartTheme'

export function SalesPurchasesChart({ series }: { series: ChartPoint[] }) {
  const { t, i18n } = useTranslation()
  const money = (v: number) => formatMoney(v, i18n.language)
  return (
    <ChartCard title={t('dashboard.chartSalesPurchases')} empty={series.length === 0}>
      <ResponsiveContainer width="100%" height={290}>
        <BarChart data={series} barGap={3}>
          <defs>
            {(['sales', 'purchases'] as const).map((key) => (
              <linearGradient key={key} id={`g-${key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={C[key]} stopOpacity={1} />
                <stop offset="100%" stopColor={C[key]} stopOpacity={0.55} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid stroke={C.grid} strokeDasharray="4 4" vertical={false} />
          <XAxis dataKey="period" tickFormatter={periodLabel} tickLine={false} axisLine={false} />
          <YAxis tickFormatter={compactNumber} tickLine={false} axisLine={false} width={48} />
          <Tooltip cursor={{ fill: 'rgba(15,23,42,.04)' }} content={<ChartTooltip format={money} titleFormat={periodLabel} />} />
          <Legend iconType="circle" />
          <Bar dataKey="sales" name={t('dashboard.sales')} fill="url(#g-sales)" radius={[6, 6, 0, 0]} maxBarSize={28} />
          <Bar dataKey="purchases" name={t('dashboard.purchases')} fill="url(#g-purchases)" radius={[6, 6, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
