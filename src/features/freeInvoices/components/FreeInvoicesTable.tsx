import { Eye, HandCoins, Pencil, ShoppingBag, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { FreeInvoice } from '@shared/types'
import { Badge, Button, DataTable, PaymentStatusBadge, RowActions } from '@/shared/components/ui'
import type { Column } from '@/shared/components/ui'
import { formatDate, formatMoney } from '@/shared/utils/format'

interface FreeInvoicesTableProps {
  rows: FreeInvoice[]
  onView: (row: FreeInvoice) => void
  onEdit: (row: FreeInvoice) => void
  onPayments: (row: FreeInvoice) => void
  onToSale: (row: FreeInvoice) => void
  onDelete: (row: FreeInvoice) => void
}

export function FreeInvoicesTable({ rows, onView, onEdit, onPayments, onToSale, onDelete }: FreeInvoicesTableProps) {
  const { t, i18n } = useTranslation()
  const money = (v: number) => formatMoney(v, i18n.language)

  const columns: Column<FreeInvoice>[] = [
    { key: 'id', header: '#', cell: (r) => <strong>#{r.id}</strong> },
    { key: 'date', header: t('common.date'), cell: (r) => formatDate(r.invoice_date) },
    {
      key: 'customer',
      header: t('freeInvoices.customer'),
      cell: (r) => (
        <span>
          {r.customer_name || <span className="text-slate-400">{t('invoice.noParty')}</span>}
          {r.customer_phone && <small className="block text-slate-500" dir="ltr">{r.customer_phone}</small>}
        </span>
      )
    },
    { key: 'lines', header: t('freeInvoices.lines'), cell: (r) => t('freeInvoices.linesCount', { count: r.lines_count, stock: r.stock_lines }) },
    { key: 'total', header: t('common.total'), cell: (r) => <strong>{money(r.total)}</strong> },
    { key: 'paid', header: t('invoice.paid'), cell: (r) => money(r.paid) },
    { key: 'remaining', header: t('invoice.remaining'), cell: (r) => <span className={r.remaining > 0 ? 'font-bold text-rose-600' : ''}>{money(r.remaining)}</span> },
    { key: 'status', header: t('freeInvoices.status'), cell: (r) => <PaymentStatusBadge paid={r.paid} remaining={r.remaining} /> },
    {
      key: 'sale',
      header: t('freeInvoices.sale'),
      cell: (r) =>
        r.sale_id ? (
          <Badge tone="teal">{t('freeInvoices.saleBadge', { id: r.sale_id })}</Badge>
        ) : r.stock_lines > 0 ? (
          <Button size="sm" icon={ShoppingBag} onClick={() => onToSale(r)}>{t('freeInvoices.toSale')}</Button>
        ) : (
          <span className="text-slate-400">—</span>
        )
    },
    {
      key: 'actions',
      header: '',
      cell: (r) => (
        <RowActions>
          <Button size="sm" icon={Eye} onClick={() => onView(r)}>{t('common.view')}</Button>
          <Button size="sm" icon={HandCoins} onClick={() => onPayments(r)}>{t('freeInvoices.payments')}</Button>
          <Button size="sm" icon={Pencil} onClick={() => onEdit(r)}>{t('common.edit')}</Button>
          <Button size="sm" variant="danger" icon={Trash2} onClick={() => onDelete(r)}>{t('common.delete')}</Button>
        </RowActions>
      )
    }
  ]

  return <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} emptyText={t('freeInvoices.empty')} />
}
