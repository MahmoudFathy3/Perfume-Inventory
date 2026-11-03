import { Pencil, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { WarehouseItem } from '@shared/types'
import { Button, DataTable, RowActions } from '@/shared/components/ui'
import type { Column } from '@/shared/components/ui'
import { formatNumber } from '@/shared/utils/format'
import { formatSar, totalCost, unitCost } from '../utils/costs'

interface WarehouseItemsTableProps {
  rows: WarehouseItem[]
  onEdit: (row: WarehouseItem) => void
  onDelete: (row: WarehouseItem) => void
}

export function WarehouseItemsTable({ rows, onEdit, onDelete }: WarehouseItemsTableProps) {
  const { t, i18n } = useTranslation()
  const sar = (v: number) => formatSar(v, i18n.language)

  const columns: Column<WarehouseItem>[] = [
    { key: 'name', header: t('common.name'), cell: (r) => <strong>{r.name}</strong> },
    {
      key: 'quantity',
      header: t('common.quantity'),
      cell: (r) => <span className={r.quantity > 0 ? '' : 'text-slate-400'}>{formatNumber(r.quantity, i18n.language)}</span>
    },
    { key: 'price', header: t('warehouse.unitPrice'), cell: (r) => sar(r.unit_price) },
    { key: 'shipping', header: t('warehouse.shipping'), cell: (r) => sar(r.shipping) },
    { key: 'customs', header: t('warehouse.customs'), cell: (r) => sar(r.customs) },
    { key: 'unitCost', header: t('warehouse.unitCost'), cell: (r) => sar(unitCost(r)) },
    { key: 'total', header: t('warehouse.totalCost'), cell: (r) => <strong>{sar(totalCost(r))}</strong> },
    { key: 'notes', header: t('common.notes'), cell: (r) => r.notes },
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
