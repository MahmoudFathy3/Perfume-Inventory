import { Pencil, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Expense } from '@shared/types'
import { Badge, Button, DataTable, RowActions } from '@/shared/components/ui'
import type { Column } from '@/shared/components/ui'
import { formatDate, formatMoney } from '@/shared/utils/format'

interface ExpensesTableProps {
  rows: Expense[]
  onEdit: (row: Expense) => void
  onDelete: (row: Expense) => void
}

export function ExpensesTable({ rows, onEdit, onDelete }: ExpensesTableProps) {
  const { t, i18n } = useTranslation()

  const columns: Column<Expense>[] = [
    { key: 'date', header: t('common.date'), cell: (r) => formatDate(r.expense_date) },
    { key: 'category', header: t('expenses.category'), cell: (r) => <strong>{r.category}</strong> },
    { key: 'amount', header: t('expenses.amount'), cell: (r) => <strong>{formatMoney(r.amount, i18n.language)}</strong> },
    {
      key: 'deduct',
      header: t('expenses.profit'),
      cell: (r) => (r.deduct ? <Badge tone="amber">{t('expenses.deducted')}</Badge> : <Badge tone="slate">{t('expenses.recordOnly')}</Badge>)
    },
    { key: 'notes', header: t('common.notes'), cell: (r) => r.notes },
    {
      key: 'actions',
      header: '',
      cell: (r) => (
        <RowActions>
          <Button size="sm" icon={Pencil} onClick={() => onEdit(r)}>{t('common.edit')}</Button>
          <Button size="sm" variant="danger" icon={Trash2} onClick={() => onDelete(r)}>{t('common.delete')}</Button>
        </RowActions>
      )
    }
  ]

  return <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} />
}
