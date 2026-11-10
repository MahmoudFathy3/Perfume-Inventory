import { ArrowLeftRight, Eye, HandCoins, Pencil, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Transfer, TransferKind } from '@shared/types'
import { Badge, Button, DataTable, RowActions } from '@/shared/components/ui'
import type { BadgeTone, Column } from '@/shared/components/ui'
import { formatDate, formatMoney } from '@/shared/utils/format'
import { TransferPaymentStatus, transferRemaining } from './TransferPaymentStatus'

const kindTone: Record<TransferKind, BadgeTone> = { capital: 'indigo', sale: 'teal', half: 'slate' }

interface TransfersTableProps {
  rows: Transfer[]
  /** اسم المخزن اللي بيظهر للمستخدم */
  nameOf: (workspaceId: number) => string
  onView: (row: Transfer) => void
  onEdit: (row: Transfer) => void
  /** المخزن النشط: بيحدد الزرار "تحصيل" (بعنا) ولا "دفع" (اشترينا) */
  activeId: number
  onPay: (row: Transfer) => void
  onDelete: (row: Transfer) => void
}

export function TransfersTable({ rows, nameOf, activeId, onView, onEdit, onPay, onDelete }: TransfersTableProps) {
  const { t, i18n } = useTranslation()
  const money = (v: number) => formatMoney(v, i18n.language)

  const columns: Column<Transfer>[] = [
    { key: 'id', header: '#', cell: (r) => r.id },
    { key: 'date', header: t('common.date'), cell: (r) => formatDate(r.transfer_date) },
    {
      key: 'route',
      header: t('transfers.route'),
      cell: (r) => (
        <span className="inline-flex items-center gap-2">
          {nameOf(r.from_workspace_id)} <ArrowLeftRight size={14} className="text-slate-400" /> {nameOf(r.to_workspace_id)}
        </span>
      )
    },
    {
      key: 'kind',
      header: t('transfers.kind'),
      cell: (r) => (
        <span className="flex flex-col items-start gap-1">
          <Badge tone={kindTone[r.kind]}>{t(`transfers.kinds.${r.kind}`)}</Badge>
          {r.sale_id && <small className="whitespace-nowrap text-slate-500">{t('transfers.fromSale', { id: r.sale_id })}</small>}
        </span>
      )
    },
    {
      key: 'partner',
      header: t('transfers.forWhom'),
      cell: (r) => (
        <span className="flex flex-col items-start gap-0.5">
          <span>{r.recipient === 'partnership' || (!r.recipient && r.kind === 'half') ? t('transfers.recipientPartnership') : (r.partner_name ?? '—')}</span>
          {r.partner_sale_id && <small className="whitespace-nowrap text-slate-500">{t('transfers.partnerInvoice', { id: r.partner_sale_id })}</small>}
        </span>
      )
    },
    { key: 'pieces', header: t('transfers.pieces'), cell: (r) => r.pieces },
    { key: 'cost', header: t('transfers.totalCost'), cell: (r) => money(r.total_cost) },
    { key: 'price', header: t('transfers.totalPrice'), cell: (r) => <strong>{money(r.total_price)}</strong> },
    { key: 'payment', header: t('transfers.payment'), cell: (r) => <TransferPaymentStatus transfer={r} /> },
    {
      key: 'actions',
      header: '',
      cell: (r) => (
        <RowActions>
          {transferRemaining(r) > 0 && (
            <Button size="sm" variant="primary" icon={HandCoins} onClick={() => onPay(r)}>{t(r.from_workspace_id === activeId ? 'transfers.collect' : 'transfers.payOut')}</Button>
          )}
          <Button size="sm" icon={Eye} onClick={() => onView(r)}>{t('common.view')}</Button>
          {!r.sale_id && <Button size="sm" icon={Pencil} onClick={() => onEdit(r)}>{t('common.edit')}</Button>}
          {!r.sale_id && <Button size="sm" variant="danger" icon={Trash2} onClick={() => onDelete(r)}>{t('common.delete')}</Button>}
        </RowActions>
      )
    }
  ]

  return <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} />
}
