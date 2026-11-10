import { useTranslation } from 'react-i18next'
import type { Transfer } from '@shared/types'
import { Badge } from '@/shared/components/ui'
import { formatMoney } from '@/shared/utils/format'

const EPS = 0.005

/** الباقي من فلوس تحويل البيع (0 للأنواع التانية) */
export const transferRemaining = (t: Transfer) => (t.kind === 'sale' ? Math.max(0, Math.round((t.total_price - t.paid) * 100) / 100) : 0)

/** حالة دفع تحويل البيع بسعر: اتدفع / اتدفع جزء (والباقي) / لسه متدفعش. الأنواع التانية ملهاش فلوس. */
export function TransferPaymentStatus({ transfer }: { transfer: Transfer }) {
  const { t, i18n } = useTranslation()
  if (transfer.kind !== 'sale') return <span className="text-slate-400">—</span>
  const remaining = transferRemaining(transfer)
  if (remaining <= EPS) return <Badge tone="green">{t('transfers.paidFull')}</Badge>
  return (
    <span className="flex flex-col items-start gap-1">
      <Badge tone={transfer.paid > 0 ? 'amber' : 'rose'}>{t(transfer.paid > 0 ? 'transfers.paidPartial' : 'transfers.unpaid')}</Badge>
      <small className="whitespace-nowrap text-slate-500">{t('transfers.remainingAmount', { amount: formatMoney(remaining, i18n.language) })}</small>
    </span>
  )
}
