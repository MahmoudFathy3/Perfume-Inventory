import { PackageOpen } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ordersApi } from '@/features/sales/api/orders.api'
import { useWorkspaces } from '@/features/workspaces'
import { useQuery } from '@/shared/hooks/useQuery'
import { formatMoney, formatNumber } from '@/shared/utils/format'

/**
 * القطع المحجوزة في فواتير تحت التجهيز (لسه في المخزن ومتخصمتش): العدد وقيمتها بسعر الطلبات وعدد الطلبات.
 * الضغط عليها بيفتح تبويب "تحت التجهيز" في المبيعات. مبتظهرش لو مفيش حاجة محجوزة.
 */
export function ReservedCard() {
  const { t, i18n } = useTranslation()
  const { active } = useWorkspaces()
  const { data } = useQuery(() => ordersApi.reserved(), [active.id])
  if (!data || data.pieces === 0) return null

  return (
    <Link
      to="/sales?tab=orders"
      className="mt-3.5 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-900 shadow-card transition hover:bg-amber-100"
    >
      <PackageOpen className="h-8 w-8 shrink-0 text-amber-600" />
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] text-amber-800">{t('dashboard.reservedTitle')}</span>
        <strong className="text-2xl text-slate-900">{t('dashboard.reservedPieces', { count: data.pieces, pieces: formatNumber(data.pieces, i18n.language) })}</strong>
      </span>
      <span className="text-sm">
        {t('dashboard.reservedSub', { value: formatMoney(data.value, i18n.language), items: data.items, orders: data.orders })}
      </span>
      <span className="text-sm font-bold underline-offset-2 hover:underline">{t('dashboard.reservedOpen')}</span>
    </Link>
  )
}
