import { PackageCheck } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { SaleOrder } from '@shared/types'
import { Alert, Button, Field, Input, Modal, NumberInput } from '@/shared/components/ui'
import { useSubmit } from '@/shared/hooks/useSubmit'
import { formatMoney, todayString } from '@/shared/utils/format'

interface ConfirmOrderDialogProps {
  order: SaleOrder
  onConfirm: (values: { sale_date: string; paid: string }) => Promise<unknown>
  onClose: () => void
}

/**
 * "اتباعت": الطلب بيتحول لفاتورة بيع بتاريخ البيع (القطع بتتخصم ساعتها). العربون بيتحسب دفعة،
 * والمدفوع دلوقتي الافتراضي الباقي كله. لو مش مدفوعة كلها لازم يكون عليها عميل.
 */
export function ConfirmOrderDialog({ order, onConfirm, onClose }: ConfirmOrderDialogProps) {
  const { t, i18n } = useTranslation()
  const money = (v: number) => formatMoney(v, i18n.language)
  const remaining = Math.round((order.total - order.deposit) * 100) / 100
  const [values, setValues] = useState({ sale_date: todayString(), paid: '' })
  const paidNow = values.paid === '' ? remaining : Number(values.paid) || 0
  const { submit, saving } = useSubmit(() => onConfirm(values))

  return (
    <Modal title={t('orders.confirmTitle', { id: order.id })} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <p className="text-sm text-slate-600">{t('orders.confirmNote')}</p>
        <div className="grid grid-cols-3 gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm">
          <span>{t('common.total')}<strong className="block">{money(order.total)}</strong></span>
          <span>{t('orders.deposit')}<strong className="block">{money(order.deposit)}</strong></span>
          <span>{t('invoice.remaining')}<strong className="block">{money(Math.max(0, remaining - paidNow))}</strong></span>
        </div>
        <div className="grid grid-cols-2 gap-x-4">
          <Field label={t('orders.saleDate')}>
            <Input type="date" value={values.sale_date} onChange={(e) => setValues({ ...values, sale_date: e.target.value })} />
          </Field>
          <Field label={t('orders.paidNow')}>
            <NumberInput value={values.paid} placeholder={t('orders.paidAllRemaining', { amount: money(remaining) })} onChange={(e) => setValues({ ...values, paid: e.target.value })} />
          </Field>
        </div>
        {!order.customer_id && <Alert tone="info">{t('orders.noCustomerNote')}</Alert>}
        <div className="flex gap-2">
          <Button type="submit" variant="primary" icon={PackageCheck} disabled={saving}>{t('orders.confirmAction')}</Button>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
        </div>
      </form>
    </Modal>
  )
}
