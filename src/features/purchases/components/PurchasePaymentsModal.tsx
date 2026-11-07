import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { PurchasePayment } from '@shared/types'
import { Button, Field, FormActions, Input, Modal, NumberInput, PaymentStatusBadge } from '@/shared/components/ui'
import { useConfirmDelete } from '@/shared/hooks/useConfirmDelete'
import { useQuery } from '@/shared/hooks/useQuery'
import { useSubmit } from '@/shared/hooks/useSubmit'
import { useToast } from '@/shared/toast/ToastProvider'
import { formatDate, formatMoney, todayString } from '@/shared/utils/format'
import { purchasesApi } from '../api/purchases.api'

interface PurchasePaymentsModalProps {
  purchaseId: number
  onClose: () => void
  /** بعد أي دفعة أو حذف (علشان الجدول يتحدّث) */
  onChanged: () => void
}

/** دفعات المورد على فاتورة شراء: الإجمالي والمدفوع والمتبقي، الدفعات اللي اتسجلت (وحذفها)، ودفعة جديدة */
export function PurchasePaymentsModal({ purchaseId, onClose, onChanged }: PurchasePaymentsModalProps) {
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const money = (v: number) => formatMoney(v, i18n.language)
  const { data: purchase, reload } = useQuery(() => purchasesApi.get({ id: purchaseId }), [purchaseId])
  const [form, setForm] = useState({ amount: '', date: todayString(), notes: '' })

  const refresh = () => {
    reload()
    onChanged()
  }

  const { submit, saving } = useSubmit(async () => {
    if (!purchase) return
    // الفاضي = المتبقي كله
    await purchasesApi.pay({ purchase_id: purchase.id, amount: form.amount === '' ? purchase.remaining : form.amount, payment_date: form.date, notes: form.notes })
    toast.success(t('purchases.paidDone'))
    setForm({ amount: '', date: todayString(), notes: '' })
    refresh()
  })

  const { ask, dialog } = useConfirmDelete<PurchasePayment>(
    async (row) => {
      await purchasesApi.removePayment({ id: row.id })
      toast.success(t('toast.deleted'))
      refresh()
    },
    { getName: (row) => `${money(row.amount)} — ${formatDate(row.payment_date)}` }
  )

  return (
    <Modal title={purchase ? t('purchases.paymentsTitle', { id: purchase.id, supplier: purchase.supplier_name }) : ''} onClose={onClose}>
      {purchase && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-4 gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm">
            <span>{t('common.total')}<strong className="block">{money(purchase.total)}</strong></span>
            <span>{t('invoice.returns')}<strong className="block">{money(purchase.returns_total)}</strong></span>
            <span>{t('invoice.paid')}<strong className="block">{money(purchase.paid)}</strong></span>
            <span>
              {t('purchases.remainingToSupplier')}
              <strong className={`block ${purchase.remaining > 0 ? 'text-rose-600' : ''}`}>{money(purchase.remaining)}</strong>
            </span>
          </div>
          <PaymentStatusBadge paid={purchase.paid} remaining={purchase.remaining} />

          <section>
            <h3 className="mb-2 font-bold">{t('purchases.paymentsList')}</h3>
            {purchase.payments.length === 0 ? (
              <p className="text-sm text-slate-400">{t('purchases.noPayments')}</p>
            ) : (
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                {purchase.payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                    <span>
                      <strong>{money(p.amount)}</strong> <span className="text-slate-500">— {formatDate(p.payment_date)}</span>
                      {p.notes && <small className="block text-slate-500">{p.notes}</small>}
                    </span>
                    <Button size="sm" variant="danger" icon={Trash2} aria-label={t('common.delete')} onClick={() => ask(p)} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {purchase.remaining > 0 && (
            <form onSubmit={submit} className="rounded-xl border border-slate-200 p-4">
              <h3 className="mb-3 font-bold">{t('purchases.newPayment')}</h3>
              <div className="grid grid-cols-2 gap-x-4">
                <Field label={t('expenses.amount')}>
                  <NumberInput value={form.amount} placeholder={t('purchases.payAllRemaining', { amount: money(purchase.remaining) })} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                </Field>
                <Field label={t('common.date')}>
                  <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </Field>
              </div>
              <Field label={t('common.notes')}>
                <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </Field>
              <FormActions saving={saving} onCancel={onClose} />
            </form>
          )}
        </div>
      )}
      {dialog}
    </Modal>
  )
}
