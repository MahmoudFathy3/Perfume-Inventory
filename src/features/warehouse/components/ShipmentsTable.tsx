import { CheckCheck, Trash2, Undo2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { WarehouseShipment } from '@shared/types'
import { Badge, Button, DataTable, RowActions } from '@/shared/components/ui'
import type { Column } from '@/shared/components/ui'
import { formatDate, formatNumber } from '@/shared/utils/format'

interface ShipmentsTableProps {
  rows: WarehouseShipment[]
  nameOf: (workspaceId: number) => string
  onToggleArrived: (row: WarehouseShipment) => void
  onDelete: (row: WarehouseShipment) => void
}

/** شحنات مخزن السعودية: رايحة فين، فيها إيه، ووصلت ولا لسه */
export function ShipmentsTable({ rows, nameOf, onToggleArrived, onDelete }: ShipmentsTableProps) {
  const { t, i18n } = useTranslation()

  const columns: Column<WarehouseShipment>[] = [
    { key: 'id', header: '#', cell: (r) => r.id },
    { key: 'date', header: t('warehouse.shipDate'), cell: (r) => formatDate(r.ship_date) },
    { key: 'destination', header: t('warehouse.destination'), cell: (r) => nameOf(r.workspace_id) },
    { key: 'items', header: t('warehouse.contents'), cell: (r) => r.items.map((l) => `${l.name} × ${l.quantity}`).join('، ') },
    { key: 'pieces', header: t('warehouse.pieces'), cell: (r) => <strong>{formatNumber(r.pieces, i18n.language)}</strong> },
    {
      key: 'status',
      header: t('warehouse.status'),
      cell: (r) =>
        r.status === 'arrived' ? (
          <Badge tone="green">{t('warehouse.arrived')} {formatDate(r.arrived_date)}</Badge>
        ) : (
          <Badge tone="amber">{t('warehouse.inTransit')}</Badge>
        )
    },
    { key: 'notes', header: t('common.notes'), cell: (r) => r.notes },
    {
      key: 'actions',
      header: '',
      cell: (r) => (
        <RowActions>
          {r.status === 'arrived' ? (
            <Button size="sm" icon={Undo2} onClick={() => onToggleArrived(r)}>{t('warehouse.markInTransit')}</Button>
          ) : (
            <Button size="sm" icon={CheckCheck} onClick={() => onToggleArrived(r)}>{t('warehouse.markArrived')}</Button>
          )}
          <Button size="sm" variant="danger" icon={Trash2} onClick={() => onDelete(r)}>{t('common.delete')}</Button>
        </RowActions>
      )
    }
  ]

  return <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} />
}
