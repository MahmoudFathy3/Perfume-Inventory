import { Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { DashboardSummary } from '@shared/types'
import { StatCard } from '@/shared/components/ui'
import { formatMoney } from '@/shared/utils/format'
import { useWorkspaces } from '@/features/workspaces'

/** حصة كل شريك من ربح الفترة المختارة (القسمة بالنص). بتظهر في الشراكات بس. */
export function PartnersShare({ summary }: { summary: DashboardSummary }) {
  const { t, i18n } = useTranslation()
  const { active } = useWorkspaces()
  if (active.kind !== 'partnership') return null

  return (
    <section className="mb-6">
      <h2 className="mb-3 flex items-center gap-2"><Users className="h-5 w-5 text-primary-600" aria-hidden="true" />{t('dashboard.partnersShare')} <small className="font-normal text-slate-500">— {t('dashboard.periodNote')}</small></h2>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3.5">
        {active.partners.map((p) => (
          <StatCard key={p.id} label={`${p.name} (${p.share_percent}%)`} value={formatMoney((summary.profit * p.share_percent) / 100, i18n.language)} sub={t('dashboard.shareOfProfit')} tone="green" />
        ))}
      </div>
    </section>
  )
}
