import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { PartnerAccount, PartnerPaymentInput } from '@shared/types'
import { Field, FormActions, Input, NumberInput, Segmented } from '@/shared/components/ui'
import { useSubmit } from '@/shared/hooks/useSubmit'
import { formatMoney, todayString } from '@/shared/utils/format'

interface PaymentFormProps {
  account: PartnerAccount
  onSubmit: (payload: PartnerPaymentInput) => Promise<unknown>
  onCancel: () => void
}

/** تسوية مع شريك: الشراكة بتدفع له (لو مستحق له) أو هو بيدفع للشراكة (لو عليه). المبلغ مقترح من الرصيد الحالي. */
export function PaymentForm({ account, onSubmit, onCancel }: PaymentFormProps) {
  const { t, i18n } = useTranslation()
  const [direction, setDirection] = useState<PartnerPaymentInput['direction']>(account.balance < 0 ? 'from_partner' : 'to_partner')
  const [amount, setAmount] = useState(account.balance === 0 ? '' : String(Math.abs(account.balance)))
  const [header, setHeader] = useState({ date: todayString(), notes: '' })
  // تحويلات بيع لسه ما اتدفعتش في نفس الاتجاه: المبلغ يروح لها الأول (افتراضي) علشان متتدفعش مرتين بعدين
  const unpaid = direction === 'to_partner' ? account.unpaid_transfers.owed_to : account.unpaid_transfers.owed_by
  const [applyToTransfers, setApplyToTransfers] = useState(true)
  const { submit, saving } = useSubmit(() =>
    onSubmit({ partner_id: account.partner.id, amount, direction, payment_date: header.date, notes: header.notes, apply_to_transfers: unpaid > 0 && applyToTransfers })
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
      {unpaid > 0 && (
        <div className={`mb-3.5 rounded-xl border px-3.5 py-3 text-sm ${applyToTransfers ? 'border-indigo-200 bg-indigo-50 text-indigo-900' : 'border-amber-300 bg-amber-50 text-amber-900'}`}>
          <label className="flex items-start gap-2">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-primary-600" checked={applyToTransfers} onChange={(e) => setApplyToTransfers(e.target.checked)} />
            <span>{t(direction === 'to_partner' ? 'partners.applyToTransfersTo' : 'partners.applyToTransfersFrom', { amount: formatMoney(unpaid, i18n.language) })}</span>
          </label>
          {!applyToTransfers && <p className="mt-1.5">{t('partners.applyToTransfersWarning')}</p>}
        </div>
      )}
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
