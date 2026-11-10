import { ShoppingBag } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useWorkspaces } from '@/features/workspaces'
import { Alert, Button, Field, Modal, NumberInput, Segmented } from '@/shared/components/ui'
import { useQuery } from '@/shared/hooks/useQuery'
import { useSubmit } from '@/shared/hooks/useSubmit'
import { formatMoney } from '@/shared/utils/format'
import { freeInvoicesApi } from '../api/freeInvoices.api'

interface ToSaleDialogProps {
  invoiceId: number
  onDone: (saleId: number) => void
  onClose: () => void
}

/**
 * "سجّل بيع": فاتورة بيع حقيقية من بنود المخزون اللي في الفاتورة الحرّة بس (القطع بتتخصم والربح بيتحسب).
 * البنود اللي من برّه والشحن والخصم مش بيدخلوا فيها. المدفوع الافتراضي كلها.
 */
export function ToSaleDialog({ invoiceId, onDone, onClose }: ToSaleDialogProps) {
  const { t, i18n } = useTranslation()
  const money = (v: number) => formatMoney(v, i18n.language)
  const { data: invoice } = useQuery(() => freeInvoicesApi.get({ id: invoiceId }), [invoiceId])
  const [paid, setPaid] = useState('')
  // في الشراكة: الشريك اللي باع (زي أي فاتورة بيع)
  const { active } = useWorkspaces()
  const partners = active.kind === 'partnership' ? active.partners : []
  const [partnerId, setPartnerId] = useState('')
  const stock = invoice?.items.filter((l) => l.item_id !== null) ?? []
  const saleTotal = stock.reduce((sum, l) => sum + l.quantity * l.unit_price, 0)

  const { submit, saving } = useSubmit(async () => {
    const saleId = await freeInvoicesApi.toSale({ id: invoiceId, paid, partner_id: partnerId ? Number(partnerId) : null, notes: t('freeInvoices.saleNote', { id: invoiceId }) })
    onDone(saleId)
  })

  return (
    <Modal title={t('freeInvoices.toSaleTitle', { id: invoiceId })} onClose={onClose}>
      {invoice && (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <p className="text-sm text-slate-600">{t('freeInvoices.toSaleNote')}</p>
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
            {stock.map((l) => (
              <li key={l.id} className="flex justify-between gap-3 px-3 py-2">
                <span>
                  {l.name} <small className="text-slate-500">({t(`condition.${l.condition}`)})</small> × {l.quantity}
                </span>
                <strong className="tabular-nums">{money(l.quantity * l.unit_price)}</strong>
              </li>
            ))}
            <li className="flex justify-between gap-3 bg-slate-50 px-3 py-2 font-bold">
              <span>{t('freeInvoices.saleTotal')}</span>
              <span className="tabular-nums">{money(saleTotal)}</span>
            </li>
          </ul>
          {partners.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold text-slate-500">{t('sales.soldBy')}</span>
              <Segmented value={partnerId} onChange={setPartnerId} options={partners.map((p) => ({ value: String(p.id), label: p.name }))} />
            </div>
          )}
          <Field label={t('sales.paidNow')}>
            <NumberInput value={paid} placeholder={t('sales.paidAll')} onChange={(e) => setPaid(e.target.value)} />
          </Field>
          {!invoice.customer_id && <Alert tone="info">{t('freeInvoices.toSaleNoCustomer')}</Alert>}
          <div className="flex gap-2">
            <Button type="submit" variant="primary" icon={ShoppingBag} disabled={saving}>{t('freeInvoices.confirmToSale')}</Button>
            <Button onClick={onClose}>{t('common.cancel')}</Button>
          </div>
        </form>
      )}
    </Modal>
  )
}
