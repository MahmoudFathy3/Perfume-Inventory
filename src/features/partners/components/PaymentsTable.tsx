import { Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { PartnerPayment } from '@shared/types'
import { Button, DataTable, RowActions } from '@/shared/components/ui'
import type { Column } from '@/shared/components/ui'
import { formatDate, formatMoney } from '@/shared/utils/format'

export function PaymentsTable({ rows, onDelete }: { rows: PartnerPayment[]; onDelete: (row: PartnerPayment) => void }) {
  const { t, i18n } = useTranslation()

  const columns: Column<PartnerPayment>[] = [
    { key: 'date', header: t('common.date'), cell: (p) => formatDate(p.payment_date) },
    {
      key: 'partner',
      header: t('partners.partner'),
      cell: (p) => (p.pair_id ? t('partners.transferRoute', { from: p.counterparty_name, to: p.partner_name }) : p.partner_name)
    },
    { key: 'type', header: t('partners.paymentType'), cell: (p) => t(p.pair_id ? 'partners.transferType' : p.amount > 0 ? 'partners.toPartner' : 'partners.fromPartner') },
    { key: 'amount', header: t('partners.amount'), cell: (p) => <strong>{formatMoney(Math.abs(p.amount), i18n.language)}</strong> },
    { key: 'notes', header: t('common.notes'), cell: (p) => [p.transfer_id ? t('transfers.linked', { id: p.transfer_id }) : null, p.notes].filter(Boolean).join(' · ') },
    { key: 'actions', header: '', cell: (p) => <RowActions><Button size="sm" variant="danger" icon={Trash2} onClick={() => onDelete(p)}>{t('common.delete')}</Button></RowActions> }
  ]

  // التسوية بين الشريكين متسجلة دفعتين: بنعرض اللي استلم بس (والحذف بيشيل الاتنين)
  const shown = rows.filter((p) => !(p.pair_id && p.amount < 0))
  return <DataTable columns={columns} rows={shown} rowKey={(p) => p.id} />
}
