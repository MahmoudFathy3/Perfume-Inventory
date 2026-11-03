import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { PartnerAccount, PartnerTransferInput } from '@shared/types'
import { Alert, Button, Field, FormActions, Input, NumberInput, Segmented } from '@/shared/components/ui'
import { useSubmit } from '@/shared/hooks/useSubmit'
import { formatMoney, todayString } from '@/shared/utils/format'

interface PartnerTransferFormProps {
  accounts: PartnerAccount[]
  onSubmit: (payload: PartnerTransferInput) => Promise<unknown>
  onCancel: () => void
}

/**
 * تسوية بين الشريكين: واحد دفع للتاني من جيبه (برا فلوس الشراكة).
 * الافتراضي: اللي "الباقي" بتاعه أقل بيدفع للي أكتر، بالمبلغ اللي يخليهم بالنص. بنعرض الرصيد بعد التسوية قبل الحفظ.
 */
export function PartnerTransferForm({ accounts, onSubmit, onCancel }: PartnerTransferFormProps) {
  const { t, i18n } = useTranslation()
  const money = (v: number) => formatMoney(v, i18n.language)
  const sorted = [...accounts].sort((a, b) => a.balance - b.balance)
  const [fromId, setFromId] = useState(sorted[0]?.partner.id ?? 0)
  const [toId, setToId] = useState(sorted[sorted.length - 1]?.partner.id ?? 0)
  const from = accounts.find((a) => a.partner.id === fromId)
  const to = accounts.find((a) => a.partner.id === toId)
  // المبلغ اللي يخلّي الاتنين بالنص
  const equalize = from && to && to.balance > from.balance ? Math.round(((to.balance - from.balance) / 2) * 100) / 100 : 0
  const [amount, setAmount] = useState(equalize > 0 ? String(equalize) : '')
  const [header, setHeader] = useState({ date: todayString(), notes: '' })
  const value = Number(amount) || 0

  // شريكين بس: لما تختار مين دفع، التاني هو اللي استلم
  const pickFrom = (id: number) => {
    setFromId(id)
    if (id === toId) setToId(accounts.find((a) => a.partner.id !== id)?.partner.id ?? 0)
  }
  const pickTo = (id: number) => {
    setToId(id)
    if (id === fromId) setFromId(accounts.find((a) => a.partner.id !== id)?.partner.id ?? 0)
  }

  const { submit, saving } = useSubmit(() =>
    onSubmit({ from_partner_id: fromId, to_partner_id: toId, amount, payment_date: header.date, notes: header.notes })
  )

  const after = (a: PartnerAccount | undefined, delta: number) => {
    if (!a) return null
    const b = Math.round((a.balance + delta) * 100) / 100
    return (
      <li className="flex justify-between gap-3">
        <span>{a.partner.name}</span>
        <strong className={b < 0 ? 'text-rose-600' : 'text-green-700'}>
          {money(Math.abs(b))} {b === 0 ? '' : t(b > 0 ? 'partners.owedToPartner' : 'partners.owedByPartner')}
        </strong>
      </li>
    )
  }
  const options = accounts.map((a) => ({ value: String(a.partner.id), label: a.partner.name }))

  return (
    <form onSubmit={submit}>
      <div className="mb-3.5 flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold text-slate-500">{t('partners.transferFrom')}</span>
        <Segmented value={String(fromId)} onChange={(v) => pickFrom(Number(v))} options={options} />
      </div>
      <div className="mb-3.5 flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold text-slate-500">{t('partners.transferTo')}</span>
        <Segmented value={String(toId)} onChange={(v) => pickTo(Number(v))} options={options} />
      </div>

      <Field label={t('partners.amount')}>
        <NumberInput value={amount} autoFocus onChange={(e) => setAmount(e.target.value)} />
      </Field>
      {equalize > 0 && Number(amount) !== equalize && (
        <p className="-mt-2 mb-3 flex flex-wrap items-center gap-2 text-sm text-slate-600">
          {t('partners.transferSuggest', { amount: money(equalize) })}
          <Button size="sm" variant="ghost" onClick={() => setAmount(String(equalize))}>{t('partners.transferUse')}</Button>
        </p>
      )}

      <div className="grid grid-cols-2 gap-x-4">
        <Field label={t('common.date')}>
          <Input type="date" value={header.date} onChange={(e) => setHeader({ ...header, date: e.target.value })} />
        </Field>
        <Field label={t('common.notes')}>
          <Input value={header.notes} onChange={(e) => setHeader({ ...header, notes: e.target.value })} />
        </Field>
      </div>

      {from && to && (
        <Alert tone="info">
          {t('partners.transferNote', { from: from.partner.name, to: to.partner.name })}
        </Alert>
      )}
      {from && to && value > 0 && (
        <div className="rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm">
          <p className="mb-1.5 font-semibold text-slate-500">{t('partners.transferAfter')}</p>
          <ul className="space-y-1">
            {after(from, value)}
            {after(to, -value)}
          </ul>
        </div>
      )}
      <FormActions saving={saving} onCancel={onCancel} />
    </form>
  )
}
