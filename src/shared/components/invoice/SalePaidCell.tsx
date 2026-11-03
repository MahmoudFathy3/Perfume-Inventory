import { useTranslation } from 'react-i18next'
import type { Sale } from '@shared/types'
import { formatMoney } from '../../utils/format'

/** اللي العميل دفعه فعلًا في الفاتورة (قبل أي رد): المدفوع المحسوب + اللي اترد كاش + اللي اتخصم من رصيده في فاتورة تانية */
export const grossPaid = (s: Pick<Sale, 'paid' | 'refunded' | 'credit_used'>) => Math.round((s.paid + s.refunded + s.credit_used) * 100) / 100

/** المدفوع، وتحته (لو فيه) اللي اترد كاش، واللي اتخصم من رصيده، والرصيد اللي ليه */
export function SalePaidCell({ sale }: { sale: Sale }) {
  const { t, i18n } = useTranslation()
  const money = (v: number) => formatMoney(v, i18n.language)
  return (
    <span className="flex flex-col">
      <span>{money(grossPaid(sale))}</span>
      {sale.refunded > 0 && <small className="whitespace-nowrap text-amber-700">{t('invoice.refunded')}: {money(sale.refunded)}</small>}
      {sale.credit_used > 0 && <small className="whitespace-nowrap text-slate-500">{t('invoice.creditUsed')}: {money(sale.credit_used)}</small>}
      {sale.credit > 0 && <small className="whitespace-nowrap font-semibold text-green-700">{t('invoice.credit')}: {money(sale.credit)}</small>}
    </span>
  )
}
