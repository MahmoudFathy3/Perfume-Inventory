import clsx from 'clsx'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@/shared/hooks/useQuery'
import { useToast } from '@/shared/toast/ToastProvider'
import { formatMoney, formatNumber } from '@/shared/utils/format'
import { useWorkspaces, workspaceIcon } from '@/features/workspaces'
import { dashboardApi } from '../api/dashboard.api'

/** كروت مختصرة لكل المخازن المفتوحة (الفعلي والشراكات). الضغط على كارت بيبدّل عليه. بتظهر لو في شراكة واحدة على الأقل. */
export function WorkspacesOverview() {
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const { active, label, activate } = useWorkspaces()
  const { data } = useQuery(() => dashboardApi.overview(), [active.id])
  if (!data || data.length < 2) return null
  const lang = i18n.language

  return (
    <section className="mb-6">
      <h2 className="mb-3">{t('dashboard.allStores')}</h2>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3.5">
        {data.map((o) => {
          const Icon = workspaceIcon(o.workspace.kind)
          const rows: [string, string, string?][] = [
            [t('dashboard.capital'), formatMoney(o.cost_value, lang)],
            [t('dashboard.totalPieces'), formatNumber(o.pieces, lang)],
            [t('dashboard.salesToday'), formatMoney(o.today_sales, lang)],
            [t('dashboard.receivables'), formatMoney(o.receivables, lang)],
            [t('dashboard.netProfit'), formatMoney(o.profit, lang), o.profit < 0 ? 'text-rose-600' : 'text-green-700']
          ]
          return (
            <button
              key={o.workspace.id}
              type="button"
              onClick={() => !o.workspace.active && activate(o.workspace.id).catch(toast.fail)}
              className={clsx(
                'rounded-2xl border bg-white p-4 text-start shadow-card transition',
                o.workspace.active ? 'border-primary-600 ring-2 ring-primary-600/20' : 'border-slate-200 hover:border-primary-600/50'
              )}
            >
              <div className="mb-2.5 flex items-center gap-2 font-bold">
                <Icon className="h-5 w-5 text-primary-600" aria-hidden="true" />
                <span className="truncate">{label(o.workspace)}</span>
              </div>
              <dl className="space-y-1 text-sm">
                {rows.map(([name, value, tone]) => (
                  <div key={name} className="flex justify-between gap-2">
                    <dt className="text-slate-500">{name}</dt>
                    <dd className={clsx('font-semibold', tone)}>{value}</dd>
                  </div>
                ))}
              </dl>
            </button>
          )
        })}
      </div>
    </section>
  )
}
