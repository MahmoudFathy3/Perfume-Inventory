import { useTranslation } from 'react-i18next'
import type { TransferDetails, TransferLine } from '@shared/types'
import { ConditionBadge, DataTable, Modal } from '@/shared/components/ui'
import type { Column } from '@/shared/components/ui'
import { formatDate, formatMoney } from '@/shared/utils/format'
import { TransferPaymentStatus } from './TransferPaymentStatus'

interface TransferDetailsModalProps {
  transfer: TransferDetails
  nameOf: (workspaceId: number) => string
  onClose: () => void
}

/** تفاصيل تحويل: الطرفين والنوع وسطور القطع بتكلفتها وبسعر التحويل */
export function TransferDetailsModal({ transfer, nameOf, onClose }: TransferDetailsModalProps) {
  const { t, i18n } = useTranslation()
  const money = (v: number) => formatMoney(v, i18n.language)

  const columns: Column<TransferLine>[] = [
    { key: 'name', header: t('common.product'), cell: (l) => l.item_name },
    { key: 'condition', header: t('condition.label'), cell: (l) => <ConditionBadge condition={l.condition} /> },
    { key: 'qty', header: t('common.quantity'), cell: (l) => l.quantity },
    { key: 'cost', header: t('transfers.unitCost'), cell: (l) => money(l.unit_cost) },
    { key: 'price', header: t('transfers.unitPrice'), cell: (l) => money(l.unit_price) },
    { key: 'total', header: t('common.total'), cell: (l) => <strong>{money(l.quantity * l.unit_price)}</strong> }
  ]

  return (
    <Modal title={`${t('transfers.title')} #${transfer.id}`} onClose={onClose} wide>
      <p className="mb-1">{nameOf(transfer.from_workspace_id)} ← {nameOf(transfer.to_workspace_id)} · {t(`transfers.kinds.${transfer.kind}`)}{transfer.partner_name ? ` · ${transfer.partner_name}` : ''}</p>
      {transfer.notes && <p className="mb-3 text-sm text-slate-500">{transfer.notes}</p>}
      {transfer.sale_id && <p className="mb-3 text-sm text-slate-500">{t('transfers.fromSale', { id: transfer.sale_id })} — {t('transfers.fromSaleNote')}</p>}
      <DataTable columns={columns} rows={transfer.items} rowKey={(l) => l.id} />
      {transfer.kind === 'sale' && (
        <>
          <h3 className="mb-2 mt-5 flex items-center gap-2">{t('transfers.payments')} <TransferPaymentStatus transfer={transfer} /></h3>
          {transfer.payments.length === 0 ? (
            <p className="text-sm text-slate-500">{t('transfers.noPayments')}</p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
              {transfer.payments.map((p) => (
                <li key={p.id} className="flex flex-wrap justify-between gap-2 px-3.5 py-2">
                  <span>{formatDate(p.payment_date)} · {p.partner_name}{p.notes ? ` · ${p.notes}` : ''}</span>
                  <strong>{money(Math.abs(p.amount))}</strong>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Modal>
  )
}
