import { Eye, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { customerLabel } from '@/shared/utils/partyName'
import type { ReturnRecord } from '@shared/types'
import { Button, DataTable, RowActions } from '@/shared/components/ui'
import type { Column } from '@/shared/components/ui'
import { formatDate, formatMoney } from '@/shared/utils/format'

interface ReturnsTableProps {
  rows: ReturnRecord[]
  onView: (row: ReturnRecord) => void
  onDelete: (row: ReturnRecord) => void
}

export function ReturnsTable({ rows, onView, onDelete }: ReturnsTableProps) {
  const { t, i18n } = useTranslation()
  const money = (v: number) => formatMoney(v, i18n.language)

  const columns: Column<ReturnRecord>[] = [
    { key: 'id', header: '#', cell: (r) => r.id },
    { key: 'date', header: t('common.date'), cell: (r) => formatDate(r.return_date) },
    { key: 'type', header: t('returns.type'), cell: (r) => t(r.type === 'sale' ? 'returns.typeSale' : 'returns.typePurchase') },
    { key: 'party', header: t('returns.party'), cell: (r) => (r.type === 'sale' ? (r.customer_name ? customerLabel(r.customer_name, r.customer_is_partner, t) : null) : r.supplier_name) },
    { key: 'reason', header: t('returns.reason'), cell: (r) => r.reason },
    { key: 'total', header: t('common.total'), cell: (r) => <strong>{money(r.total)}</strong> },
    {
      key: 'refunded',
      header: t('invoice.refunded'),
      cell: (r) => (r.type === 'sale' && r.refunded > 0 ? <span className="text-amber-700">{money(r.refunded)}</span> : <span className="text-slate-400">—</span>)
    },
    {
      key: 'invoice',
      header: t('returns.invoiceNow'),
      // حالة فاتورة البيع بعد المرتجعات: لسه عليه، ليه رصيد، ولا خالصة
      cell: (r) => {
        if (r.type !== 'sale' || r.sale_remaining === null) return <span className="text-slate-400">—</span>
        if (r.sale_remaining > 0) return <span className="text-rose-600">{t('returns.stillOwes', { amount: money(r.sale_remaining) })}</span>
        if ((r.sale_credit ?? 0) > 0) return <strong className="text-green-700">{t('invoice.credit')}: {money(r.sale_credit!)}</strong>
        return <span className="text-slate-500">{t('returns.settled')}</span>
      }
    },
    {
      key: 'actions',
      header: '',
      cell: (r) => (
        <RowActions>
          <Button size="sm" icon={Eye} onClick={() => onView(r)}>{t('common.view')}</Button>
          <Button size="sm" variant="danger" icon={Trash2} onClick={() => onDelete(r)}>{t('common.delete')}</Button>
        </RowActions>
      )
    }
  ]

  return <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} />
}
