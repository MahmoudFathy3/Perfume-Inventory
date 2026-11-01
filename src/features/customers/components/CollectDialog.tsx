import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Field, FormActions, Input, Modal, NumberInput } from '@/shared/components/ui'
import { useSubmit } from '@/shared/hooks/useSubmit'
import { formatMoney, todayString } from '@/shared/utils/format'

export interface CollectValues {
  amount: string
  payment_date: string
  notes: string
}

interface CollectDialogProps {
  /** اسم العميل أو رقم الفاتورة اللي بنحصّل عليها */
  subject: string
  /** أقصى مبلغ ينفع يتحصّل (المتبقي) */
  remaining: number
  /** true لو التحصيل على العميل كله (بيتوزع على أقدم فواتيره) */
  perCustomer?: boolean
  onSubmit: (values: CollectValues) => Promise<unknown>
  onClose: () => void
}

/** تحصيل مبلغ من عميل (من قايمة العملاء أو من كشف حسابه) */
export function CollectDialog({ subject, remaining, perCustomer = false, onSubmit, onClose }: CollectDialogProps) {
  const { t, i18n } = useTranslation()
  const [values, setValues] = useState<CollectValues>({ amount: String(remaining), payment_date: todayString(), notes: '' })
  const { submit, saving } = useSubmit(() => onSubmit(values))

  return (
    <Modal title={t('customers.collect')} onClose={onClose}>
      <p className="mb-2 rounded-xl bg-slate-100 px-3 py-2.5 font-bold">{subject}</p>
      <p className="mb-3 text-sm text-slate-500">
        {t('invoice.remaining')}: <strong className="text-rose-600">{formatMoney(remaining, i18n.language)}</strong>
      </p>
      {perCustomer && <Alert tone="info">{t('customers.collectOldestFirst')}</Alert>}
      <form onSubmit={submit}>
        <Field label={t('customers.amount')}>
          <NumberInput max={remaining} value={values.amount} onChange={(e) => setValues({ ...values, amount: e.target.value })} autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-x-4">
          <Field label={t('common.date')}>
            <Input type="date" value={values.payment_date} onChange={(e) => setValues({ ...values, payment_date: e.target.value })} />
          </Field>
          <Field label={t('common.notes')}>
            <Input value={values.notes} onChange={(e) => setValues({ ...values, notes: e.target.value })} />
          </Field>
        </div>
        <FormActions saving={saving} onCancel={onClose} submitLabel={t('customers.confirmCollect')} />
      </form>
    </Modal>
  )
}
