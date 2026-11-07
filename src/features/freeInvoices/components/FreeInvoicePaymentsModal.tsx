import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { FreeInvoicePayment } from '@shared/types'
import { Button, Field, FormActions, Input, Modal, NumberInput, PaymentStatusBadge } from '@/shared/components/ui'
import { useConfirmDelete } from '@/shared/hooks/useConfirmDelete'
import { useQuery } from '@/shared/hooks/useQuery'
import { useSubmit } from '@/shared/hooks/useSubmit'
import { useToast } from '@/shared/toast/ToastProvider'
import { formatDate, formatMoney, todayString } from '@/shared/utils/format'
import { freeInvoicesApi } from '../api/freeInvoices.api'

interface FreeInvoicePaymentsModalProps {
  invoiceId: number
  onClose: () => void
  /** بعد أي دفعة أو حذف (علشان الجدول يتحدّث) */
  onChanged: () => void
}

/** دفعات العميل على فاتورة حرّة: الإجمالي والمدفوع والباقي، الدفعات اللي اتسجلت (وحذفها)، ودفعة جديدة */
export function FreeInvoicePaymentsModal({ invoiceId, onClose, onChanged }: FreeInvoicePaymentsModalProps) {
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const money = (v: number) => formatMoney(v, i18n.language)
  const { data: invoice, reload } = useQuery(() => freeInvoicesApi.get({ id: invoiceId }), [invoiceId])
  const [form, setForm] = useState({ amount: '', date: todayString(), notes: '' })

  const refresh = () => {
    reload()
    onChanged()
  }

  const { submit, saving } = useSubmit(async () => {
    if (!invoice) return
    // الفاضي = الباقي كله
    await freeInvoicesApi.pay({ invoice_id: invoice.id, amount: form.amount === '' ? invoice.remaining : form.amount, payment_date: form.date, notes: form.notes })
    toast.success(t('toast.saved'))
    setForm({ amount: '', date: todayString(), notes: '' })
    refresh()
  })

  const { ask, dialog } = useConfirmDelete<FreeInvoicePayment>(
    async (row) => {
      await freeInvoicesApi.removePayment({ id: row.id })
      toast.success(t('toast.deleted'))
      refresh()
    },
    { getName: (row) => `${money(row.amount)} — ${formatDate(row.payment_date)}` }
  )

  return (
    <Modal title={invoice ? t('freeInvoices.paymentsTitle', { id: invoice.id, name: invoice.customer_name ?? t('invoice.noParty') }) : ''} onClose={onClose}>
      {invoice && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm">
            <span>{t('common.total')}<strong className="block">{money(invoice.total)}</strong></span>
            <span>{t('invoice.paid')}<strong className="block">{money(invoice.paid)}</strong></span>
            <span>
              {t('invoice.remaining')}
              <strong className={`block ${invoice.remaining > 0 ? 'text-rose-600' : ''}`}>{money(invoice.remaining)}</strong>
            </span>
          </div>
          <PaymentStatusBadge paid={invoice.paid} remaining={invoice.remaining} />

          <section>
            <h3 className="mb-2 font-bold">{t('freeInvoices.paymentsList')}</h3>
            {invoice.payments.length === 0 ? (
              <p className="text-sm text-slate-400">{t('freeInvoices.noPayments')}</p>
            ) : (
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                {invoice.payments.map((p) => (
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

          {invoice.remaining > 0 && (
            <form onSubmit={submit} className="rounded-xl border border-slate-200 p-4">
              <h3 className="mb-3 font-bold">{t('freeInvoices.newPayment')}</h3>
              <div className="grid grid-cols-2 gap-x-4">
                <Field label={t('expenses.amount')}>
                  <NumberInput value={form.amount} placeholder={t('freeInvoices.payAll', { amount: money(invoice.remaining) })} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
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
