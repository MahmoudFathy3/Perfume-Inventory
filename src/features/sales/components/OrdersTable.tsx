import { PackageCheck, Pencil, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { SaleOrder } from '@shared/types'
import { Badge, Button, DataTable, RowActions } from '@/shared/components/ui'
import type { Column } from '@/shared/components/ui'
import { formatDate, formatMoney, formatNumber } from '@/shared/utils/format'

interface OrdersTableProps {
  rows: SaleOrder[]
  showPartner: boolean
  onConfirm: (row: SaleOrder) => void
  onEdit: (row: SaleOrder) => void
  onCancel: (row: SaleOrder) => void
}

/** فواتير تحت التجهيز: الأقدم الأول، ومع كل واحدة "اتباعت" و"تعديل" و"إلغاء" */
export function OrdersTable({ rows, showPartner, onConfirm, onEdit, onCancel }: OrdersTableProps) {
  const { t, i18n } = useTranslation()
  const money = (v: number) => formatMoney(v, i18n.language)

  const columns: Column<SaleOrder>[] = [
    { key: 'id', header: '#', cell: (r) => <strong>#{r.id}</strong> },
    { key: 'date', header: t('orders.orderDate'), cell: (r) => formatDate(r.order_date) },
    { key: 'customer', header: t('sales.customerName'), cell: (r) => r.customer_name ?? <span className="text-slate-400">{t('invoice.noParty')}</span> },
    ...(showPartner ? [{ key: 'partner', header: t('sales.soldBy'), cell: (r: SaleOrder) => r.partner_name }] : []),
    { key: 'pieces', header: t('orders.pieces'), cell: (r) => t('orders.piecesSub', { pieces: formatNumber(r.pieces, i18n.language), lines: r.lines_count }) },
    { key: 'total', header: t('common.total'), cell: (r) => <strong>{money(r.total)}</strong> },
    { key: 'deposit', header: t('orders.deposit'), cell: (r) => (r.deposit > 0 ? money(r.deposit) : <span className="text-slate-400">—</span>) },
    { key: 'status', header: t('orders.status'), cell: () => <Badge tone="amber">{t('orders.preparing')}</Badge> },
    {
      key: 'actions',
      header: '',
      cell: (r) => (
        <RowActions>
          <Button size="sm" variant="primary" icon={PackageCheck} onClick={() => onConfirm(r)}>{t('orders.confirm')}</Button>
          <Button size="sm" icon={Pencil} onClick={() => onEdit(r)}>{t('common.edit')}</Button>
          <Button size="sm" variant="danger" icon={X} onClick={() => onCancel(r)}>{t('orders.cancel')}</Button>
        </RowActions>
      )
    }
  ]

  return <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} emptyText={t('orders.empty')} />
}
