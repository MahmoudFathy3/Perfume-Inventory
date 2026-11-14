import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ordersApi } from '@/features/sales/api/orders.api'
import { useWorkspaces } from '@/features/workspaces'
import { Card, ConditionBadge } from '@/shared/components/ui'
import { useQuery } from '@/shared/hooks/useQuery'
import { formatDate, formatMoney, formatNumber } from '@/shared/utils/format'

/**
 * الطلبات (فواتير تحت التجهيز) اللي حاجزة المنتج ده: رقم الطلب والعميل والكمية وسعره.
 * ممكن يكون الطلب في مخزن تاني (القطعة جاية من هنا). مبتظهرش لو مفيش حجز.
 */
export function ReservedOrders({ itemId }: { itemId: number }) {
  const { t, i18n } = useTranslation()
  const { active, workspaces, label } = useWorkspaces()
  const { data } = useQuery(() => ordersApi.forItem({ item_id: itemId }), [itemId])
  if (!data || data.length === 0) return null
  const total = data.reduce((sum, o) => sum + o.quantity, 0)
  const storeOf = (id: number) => {
    const ws = workspaces.find((w) => w.id === id)
    return ws ? label(ws) : `#${id}`
  }

  return (
    <Card className="mb-3.5 !p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-3">
        <h3 className="text-amber-900">{t('items.reservedOrdersTitle', { count: total, pieces: formatNumber(total, i18n.language) })}</h3>
        <Link to="/sales?tab=orders" className="text-sm font-bold text-amber-800 hover:underline">{t('dashboard.reservedOpen')}</Link>
      </div>
      <ul className="divide-y divide-slate-100 text-sm">
        {data.map((o) => (
          <li key={`${o.order_id}-${o.condition}`} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5">
            <span>
              <strong>#{o.order_id}</strong> · {formatDate(o.order_date)} · {o.customer_name ?? t('invoice.noParty')}
              {o.workspace_id !== active.id && <small className="ms-2 rounded-md bg-amber-100 px-1.5 text-amber-800">{storeOf(o.workspace_id)}</small>}
            </span>
            <span className="flex items-center gap-3">
              <ConditionBadge condition={o.condition} />
              <strong>× {formatNumber(o.quantity, i18n.language)}</strong>
              <span className="text-slate-500">{formatMoney(o.selling_price, i18n.language)}</span>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  )
}
