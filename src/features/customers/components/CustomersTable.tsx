import { Eye, HandCoins, Pencil, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { CustomerSummary } from '@shared/types'
import { Button, DataTable, RowActions } from '@/shared/components/ui'
import type { Column } from '@/shared/components/ui'
import { formatMoney, formatNumber } from '@/shared/utils/format'

interface CustomersTableProps {
  rows: CustomerSummary[]
  onDetails: (row: CustomerSummary) => void
  onCollect: (row: CustomerSummary) => void
  onEdit: (row: CustomerSummary) => void
  onDelete: (row: CustomerSummary) => void
}

export function CustomersTable({ rows, onDetails, onCollect, onEdit, onDelete }: CustomersTableProps) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const money = (v: number) => formatMoney(v, lang)

  const columns: Column<CustomerSummary>[] = [
    { key: 'name', header: t('common.name'), cell: (r) => <Button variant="link" onClick={() => onDetails(r)}>{r.name}</Button> },
    { key: 'phone', header: t('customers.phone'), cell: (r) => <span dir="ltr">{r.phone}</span> },
    { key: 'count', header: t('customers.salesCount'), cell: (r) => formatNumber(r.sales_count, lang) },
    { key: 'total', header: t('common.total'), cell: (r) => money(r.total) },
    { key: 'paid', header: t('invoice.paid'), cell: (r) => money(r.paid) },
    {
      key: 'remaining',
      header: t('invoice.remaining'),
      cell: (r) => <strong className={r.remaining > 0 ? 'text-rose-600' : 'text-slate-400'}>{money(r.remaining)}</strong>
    },
    {
      key: 'actions',
      header: t('common.actions'),
      cell: (r) => (
        <RowActions>
          <Button size="sm" icon={Eye} onClick={() => onDetails(r)}>{t('customers.statement')}</Button>
          {r.remaining > 0 && <Button size="sm" variant="primary" icon={HandCoins} onClick={() => onCollect(r)}>{t('customers.collect')}</Button>}
          <Button size="sm" icon={Pencil} onClick={() => onEdit(r)}>{t('common.edit')}</Button>
          <Button size="sm" variant="danger" icon={Trash2} onClick={() => onDelete(r)}>{t('common.delete')}</Button>
        </RowActions>
      )
    }
  ]

  return <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} />
}
