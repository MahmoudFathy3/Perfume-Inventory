import { Pencil, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Category } from '@shared/types'
import { Button, DataTable, RowActions } from '@/shared/components/ui'
import type { Column } from '@/shared/components/ui'
import { formatNumber } from '@/shared/utils/format'

interface CategoriesTableProps {
  rows: Category[]
  onEdit: (row: Category) => void
  onDelete: (row: Category) => void
}

export function CategoriesTable({ rows, onEdit, onDelete }: CategoriesTableProps) {
  const { t, i18n } = useTranslation()

  const columns: Column<Category>[] = [
    { key: 'name', header: t('common.name'), cell: (r) => <strong>{r.name}</strong> },
    { key: 'count', header: t('categories.productsCount'), cell: (r) => formatNumber(r.items_count, i18n.language) },
    {
      key: 'actions',
      header: t('common.actions'),
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
