import { useTranslation } from 'react-i18next'
import type { ClosedMonth } from '@shared/types'
import { EmptyState } from '@/shared/components/ui'
import { formatDate, formatMoney } from '@/shared/utils/format'
import { monthName } from './MonthlyClosingModal'

/**
 * الشهور المقفولة في الشراكة (الأحدث الأول): لكل شهر كل شريك نصيبه من الربح كام، وخد كام، وفضل له كام.
 * الأرقام زي ما اتحفظت وقت التقفيل. الضغط على الشهر بيفتح تفاصيله.
 */
export function ClosedMonthsTable({ months, onOpen, emptyText }: { months: ClosedMonth[]; onOpen: (month: string) => void; emptyText?: string }) {
  const { t, i18n } = useTranslation()
  const money = (v: number) => formatMoney(v, i18n.language)
  const isDay = months[0]?.month.length === 10
  if (months.length === 0) return <EmptyState>{emptyText ?? t('partners.closing.noClosed')}</EmptyState>

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <th className="px-3 py-2.5 text-start">{t(isDay ? 'partners.closing.day.label' : 'partners.closing.month')}</th>
            <th className="px-3 py-2.5 text-end">{t('dashboard.netProfit')}</th>
            <th className="px-3 py-2.5 text-start">{t('partners.closing.partner')}</th>
            <th className="px-3 py-2.5 text-end">{t('partners.profitShare')}</th>
            <th className="px-3 py-2.5 text-end">{t(isDay ? 'partners.closing.day.took' : 'partners.closing.took')}</th>
            <th className="px-3 py-2.5 text-end">{t(isDay ? 'partners.closing.day.closing' : 'partners.closing.closing')}</th>
          </tr>
        </thead>
        {months.map((m) => (
          <tbody key={m.month} className="border-t border-slate-200">
            {m.rows.map((r, i) => (
              <tr key={r.partner.id} className={i > 0 ? 'border-t border-slate-100' : undefined}>
                {i === 0 && (
                  <>
                    <td rowSpan={m.rows.length} className="px-3 py-2.5 align-top">
                      <button type="button" className="font-bold text-primary-700 hover:underline" onClick={() => onOpen(m.month)}>
                        {m.month.length === 10 ? formatDate(m.month) : monthName(m.month, i18n.language)}
                      </button>
                      <small className="block text-slate-500">{t('partners.closing.closedOn', { date: formatDate(m.closed_at.slice(0, 10)) })}</small>
                      {m.notes && <small className="block text-slate-500">{m.notes}</small>}
                    </td>
                    <td rowSpan={m.rows.length} className="px-3 py-2.5 text-end align-top font-bold tabular-nums">{money(m.net_profit)}</td>
                  </>
                )}
                <td className="px-3 py-2.5">{r.partner.name} <small className="text-slate-500">({r.partner.share_percent}%)</small></td>
                <td className="px-3 py-2.5 text-end tabular-nums">{money(r.profit_share)}</td>
                <td className="px-3 py-2.5 text-end font-bold tabular-nums text-indigo-700">{money(r.settled)}</td>
                <td className={`px-3 py-2.5 text-end font-bold tabular-nums ${r.closing >= 0 ? 'text-green-700' : 'text-rose-600'}`}>{money(r.closing)}</td>
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  )
}
