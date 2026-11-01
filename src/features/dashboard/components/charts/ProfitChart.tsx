import clsx from 'clsx'
import { useTranslation } from 'react-i18next'
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ChartPoint } from '@shared/types'
import { formatMoney, formatNumber } from '@/shared/utils/format'
import { ChartCard } from './ChartCard'
import { ChartTooltip } from './ChartTooltip'
import { CHART_COLORS as C, compactNumber, percentChange, periodLabel } from './chartTheme'

interface ProfitPoint extends ChartPoint {
  /** الفرق عن النقطة اللي قبلها (null للنقطة الأولى) */
  delta: number | null
  prev: number | null
}

/** سهم صغير على كل نقطة: ▲ أخضر لو الربح زاد عن اللي قبله، ▼ أحمر لو قل */
function TrendDot({ cx, cy, payload, many }: { cx?: number; cy?: number; payload?: ProfitPoint; many: boolean }) {
  if (cx == null || cy == null || !payload) return null
  if (payload.delta == null || payload.delta === 0) {
    return <circle cx={cx} cy={cy} r={many ? 2 : 4} fill="#94a3b8" stroke="#fff" strokeWidth={1.5} />
  }
  const up = payload.delta > 0
  const s = many ? 3.5 : 6
  const points = up
    ? `${cx},${cy - s - 1} ${cx - s},${cy + s - 1} ${cx + s},${cy + s - 1}`
    : `${cx},${cy + s + 1} ${cx - s},${cy - s + 1} ${cx + s},${cy - s + 1}`
  return <polygon points={points} fill={up ? C.up : C.down} stroke="#fff" strokeWidth={1.2} strokeLinejoin="round" />
}

/** شارة إجمالي الربح ومقارنته بالفترة السابقة */
export function ProfitBadge({ profit, previous }: { profit: number; previous: number | null }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const diff = previous === null ? null : profit - previous
  const pct = previous === null ? null : percentChange(profit, previous)
  const up = diff === null ? profit >= 0 : diff >= 0
  const sign = (n: number) => (n >= 0 ? '+' : '−')

  return (
    <div className={clsx('flex flex-col gap-0.5 rounded-xl px-3.5 py-2 font-bold', up ? 'bg-green-100 text-green-800' : 'bg-rose-100 text-rose-800')}>
      <span>
        {diff === null ? '' : up ? '▲' : '▼'} {t('dashboard.profitTotal')}: {formatMoney(profit, lang)}
      </span>
      {diff !== null && (
        <small className="font-medium">
          <bdi dir="ltr">
            {pct !== null ? `${sign(pct)}${formatNumber(Math.abs(Math.round(pct * 10) / 10), lang)}%` : `${sign(diff)}${formatMoney(Math.abs(diff), lang)}`}
          </bdi>{' '}
          {t('dashboard.vsPreviousShort')} (<bdi dir="ltr">{formatMoney(previous, lang)}</bdi>)
        </small>
      )}
    </div>
  )
}

interface ProfitChartProps {
  series: ChartPoint[]
  profit: number
  previous: number | null
}

export function ProfitChart({ series, profit, previous }: ProfitChartProps) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const money = (v: number) => formatMoney(v, lang)
  const data: ProfitPoint[] = series.map((p, i) => ({ ...p, delta: i > 0 ? p.profit - series[i - 1].profit : null, prev: i > 0 ? series[i - 1].profit : null }))

  // لون الخط والتعبئة: أخضر فوق الصفر وأحمر تحته
  const values = data.map((d) => d.profit)
  const hi = Math.max(...values)
  const lo = Math.min(...values)
  const offset = lo >= 0 ? 1 : hi <= 0 ? 0 : hi / (hi - lo)

  const footer = (row: Record<string, number>) => {
    const delta = row.delta
    if (delta == null) return null
    const sign = delta >= 0 ? '+' : '−'
    const pct = row.prev ? ` (${sign}${formatNumber(Math.abs(Math.round((delta / Math.abs(row.prev)) * 1000) / 10), lang)}%)` : ''
    return (
      <div className={clsx('mt-1.5 border-t border-dashed border-slate-200 pt-1.5 font-bold', delta >= 0 ? 'text-green-600' : 'text-rose-600')}>
        {delta >= 0 ? '▲' : '▼'} {t('dashboard.changeFromPrev')}: <bdi dir="ltr">{sign}{money(Math.abs(delta))}{pct}</bdi>
      </div>
    )
  }

  return (
    <ChartCard title={t('dashboard.chartProfit')} extra={<ProfitBadge profit={profit} previous={previous} />} empty={series.length === 0} wide>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="profitStroke" x1="0" y1="0" x2="0" y2="1">
              <stop offset={offset} stopColor={C.up} />
              <stop offset={offset} stopColor={C.down} />
            </linearGradient>
            <linearGradient id="profitFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.up} stopOpacity={0.35} />
              <stop offset={offset} stopColor={C.up} stopOpacity={0.03} />
              <stop offset={offset} stopColor={C.down} stopOpacity={0.03} />
              <stop offset="100%" stopColor={C.down} stopOpacity={0.35} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={C.grid} strokeDasharray="4 4" vertical={false} />
          <XAxis dataKey="period" tickFormatter={periodLabel} tickLine={false} axisLine={false} />
          <YAxis tickFormatter={compactNumber} tickLine={false} axisLine={false} width={48} />
          <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="2 2" />
          <Tooltip content={<ChartTooltip format={money} titleFormat={periodLabel} footer={footer} />} />
          <Area
            type="monotone"
            dataKey="profit"
            name={t('dashboard.profit')}
            stroke="url(#profitStroke)"
            strokeWidth={3}
            fill="url(#profitFill)"
            dot={(props: { cx?: number; cy?: number; payload?: ProfitPoint; index?: number }) => <TrendDot key={props.index} {...props} many={data.length > 31} />}
            activeDot={{ r: 6 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
