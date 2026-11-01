import { Eye, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
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

  const columns: Column<ReturnRecord>[] = [
    { key: 'id', header: '#', cell: (r) => r.id },
    { key: 'date', header: t('common.date'), cell: (r) => formatDate(r.return_date) },
    { key: 'type', header: t('returns.type'), cell: (r) => t(r.type === 'sale' ? 'returns.typeSale' : 'returns.typePurchase') },
    { key: 'party', header: t('returns.party'), cell: (r) => (r.type === 'sale' ? r.customer_name : r.supplier_name) },
    { key: 'reason', header: t('returns.reason'), cell: (r) => r.reason },
    { key: 'total', header: t('common.total'), cell: (r) => <strong>{formatMoney(r.total, i18n.language)}</strong> },
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
