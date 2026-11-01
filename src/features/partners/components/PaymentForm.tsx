import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { PartnerAccount, PartnerPaymentInput } from '@shared/types'
import { Field, FormActions, Input, NumberInput, Segmented } from '@/shared/components/ui'
import { useSubmit } from '@/shared/hooks/useSubmit'
import { todayString } from '@/shared/utils/format'

interface PaymentFormProps {
  account: PartnerAccount
  onSubmit: (payload: PartnerPaymentInput) => Promise<unknown>
  onCancel: () => void
}

/** تسوية مع شريك: الشراكة بتدفع له (لو مستحق له) أو هو بيدفع للشراكة (لو عليه). المبلغ مقترح من الرصيد الحالي. */
export function PaymentForm({ account, onSubmit, onCancel }: PaymentFormProps) {
  const { t } = useTranslation()
  const [direction, setDirection] = useState<PartnerPaymentInput['direction']>(account.balance < 0 ? 'from_partner' : 'to_partner')
  const [amount, setAmount] = useState(account.balance === 0 ? '' : String(Math.abs(account.balance)))
  const [header, setHeader] = useState({ date: todayString(), notes: '' })
  const { submit, saving } = useSubmit(() =>
    onSubmit({ partner_id: account.partner.id, amount, direction, payment_date: header.date, notes: header.notes })
  )

  return (
    <form onSubmit={submit}>
      <p className="mb-3">{account.partner.name}</p>
      <div className="mb-3.5 flex flex-col gap-1.5">
        <Segmented
          value={direction}
          onChange={setDirection}
          options={[
            { value: 'to_partner', label: t('partners.toPartner') },
            { value: 'from_partner', label: t('partners.fromPartner') }
          ]}
        />
      </div>
      <Field label={t('partners.amount')}>
        <NumberInput value={amount} autoFocus onChange={(e) => setAmount(e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-x-4">
        <Field label={t('common.date')}>
          <Input type="date" value={header.date} onChange={(e) => setHeader({ ...header, date: e.target.value })} />
        </Field>
        <Field label={t('common.notes')}>
          <Input value={header.notes} onChange={(e) => setHeader({ ...header, notes: e.target.value })} />
        </Field>
      </div>
      <FormActions saving={saving} onCancel={onCancel} />
    </form>
  )
}
