import { useTranslation } from 'react-i18next'
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { TopProduct } from '@shared/types'
import { formatNumber, itemName } from '@/shared/utils/format'
import { ChartCard } from './ChartCard'
import { ChartTooltip } from './ChartTooltip'
import { CHART_COLORS as C } from './chartTheme'

/** أكتر 5 منتجات مبيعًا (بأرقام الترتيب) */
export function TopProductsChart({ top }: { top: TopProduct[] }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const data = top.map((p, i) => ({ name: `${i + 1}. ${itemName(p, lang)}`, quantity: p.quantity }))
  return (
    <ChartCard title={t('dashboard.chartTop')} empty={top.length === 0}>
      <ResponsiveContainer width="100%" height={290}>
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 36 }}>
          <defs>
            <linearGradient id="g-top" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={C.sales} stopOpacity={0.6} />
              <stop offset="100%" stopColor={C.sales} stopOpacity={1} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={C.grid} strokeDasharray="4 4" horizontal={false} />
          <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="name" width={130} tickLine={false} axisLine={false} />
          <Tooltip cursor={{ fill: 'rgba(15,23,42,.04)' }} content={<ChartTooltip format={(v) => `${formatNumber(v, lang)} ${t('dashboard.pieces')}`} />} />
          <Bar dataKey="quantity" name={t('dashboard.soldPieces')} fill="url(#g-top)" radius={[0, 8, 8, 0]} maxBarSize={26}>
            <LabelList dataKey="quantity" position="right" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
