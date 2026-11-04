import clsx from 'clsx'
import { useTranslation } from 'react-i18next'
import type { PartnerStatementLine } from '@shared/types'
import { Modal } from '@/shared/components/ui'
import { useQuery } from '@/shared/hooks/useQuery'
import { formatDate, formatMoney } from '@/shared/utils/format'
import { partnersApi } from '../api/partners.api'

interface PartnerStatementModalProps {
  partnerId: number
  name: string
  onClose: () => void
}

/**
 * كشف حساب شريك بالتفصيل: "الباقي" في الجدول جاي منين خطوة بخطوة،
 * وتحت كل بند الحركات اللي كوّنته (مجموعها = رقم البند في الجدول).
 */
export function PartnerStatementModal({ partnerId, name, onClose }: PartnerStatementModalProps) {
  const { t, i18n } = useTranslation()
  const { data } = useQuery(() => partnersApi.statement({ partner_id: partnerId }), [partnerId])
  const money = (v: number) => formatMoney(v, i18n.language)
  const signed = (v: number) => `${v < 0 ? '−' : '+'} ${money(Math.abs(v))}`

  return (
    <Modal title={t('partners.statement.title', { name })} onClose={onClose} wide>
      {!data ? null : (
        <div className="flex flex-col gap-5">
          {breakdown()}
          {capitalNote()}
          <section className="flex flex-col gap-2">
            <h3 className="font-bold">{t('partners.statement.movements')}</h3>
            {linesOf(t('partners.sold'), data.lines.sold)}
            {linesOf(t('partners.paidOut'), data.lines.paid_out)}
            {linesOf(t('partners.settled'), data.lines.settled, t('partners.statement.settledNote'))}
            {linesOf(t('partners.capital'), data.lines.capital)}
          </section>
        </div>
      )}
    </Modal>
  )

  /** المعادلة: نصيب الربح + باعه + دفعه − اتدفع له = الباقي */
  function breakdown() {
    if (!data) return null
    const { account: a, profit: p } = data
    // التسوية: موجب = اتدفع له (بيقلل الباقي)، سالب = هو اللي دفع للشراكة (بيزوّد الباقي)
    const rows: { label: string; hint: string; value: number }[] = [
      {
        label: t('partners.profitShare'),
        hint: t('partners.statement.shareHow', { actual: money(p.actual), expenses: money(p.expenses), net: money(p.net), percent: p.share_percent }),
        value: a.profit_share
      },
      { label: t('partners.sold'), hint: t('partners.soldHint'), value: a.sold },
      { label: t('partners.paidOut'), hint: t('partners.paidOutHint'), value: a.paid_out },
      {
        label: t(a.settled >= 0 ? 'partners.statement.paidToHim' : 'partners.statement.paidByHim'),
        hint: t('partners.settledHint'),
        value: -a.settled
      }
    ]
    const owed = a.balance > 0
    return (
      <section className="rounded-xl border border-slate-200">
        <h3 className="border-b border-slate-200 px-4 py-2.5 font-bold">{t('partners.statement.howTitle')}</h3>
        <ul className="divide-y divide-slate-100">
          {rows.map((r) => (
            <li key={r.label} className="flex items-start justify-between gap-4 px-4 py-2.5">
              <span>
                <span className="font-semibold">{r.label}</span>
                <small className="block text-slate-500">{r.hint}</small>
              </span>
              <strong className={clsx('whitespace-nowrap', r.value < 0 ? 'text-rose-600' : 'text-slate-800')}>{signed(r.value)}</strong>
            </li>
          ))}
        </ul>
        <div className={clsx('flex items-center justify-between gap-4 rounded-b-xl px-4 py-3', a.balance < 0 ? 'bg-rose-50' : 'bg-green-50')}>
          <span>
            <span className="font-bold">= {t('partners.balance')}</span>
            <small className="block text-slate-600">
              {a.balance === 0
                ? t('partners.statement.balanceZero')
                : t(owed ? 'partners.statement.balanceOwed' : 'partners.statement.balanceOwes', { name, amount: money(Math.abs(a.balance)) })}
            </small>
          </span>
          <strong className={clsx('whitespace-nowrap text-lg', a.balance < 0 ? 'text-rose-600' : 'text-green-700')}>
            {money(Math.abs(a.balance))} {a.balance !== 0 && <small>{t(owed ? 'partners.owedToPartner' : 'partners.owedByPartner')}</small>}
          </strong>
        </div>
      </section>
    )
  }

  /** رأس المال بيتحسب لوحده: بيرجعله عند التصفية زيادة على الباقي */
  function capitalNote() {
    if (!data) return null
    const { capital, balance } = data.account
    return (
      <section className="rounded-xl bg-slate-50 px-4 py-3 text-sm">
        <div className="flex justify-between gap-4">
          <span className="font-semibold">{t('partners.capital')}</span>
          <strong>{money(capital)}</strong>
        </div>
        <p className="mt-1 text-slate-600">{t('partners.statement.capitalNote', { total: money(capital + balance) })}</p>
      </section>
    )
  }

  /** حركات بند واحد (بتتفتح وتتقفل) ومجموعها */
  function linesOf(title: string, lines: PartnerStatementLine[], note?: string) {
    const total = lines.reduce((sum, l) => sum + l.amount, 0)
    return (
      <details className="rounded-xl border border-slate-200 [&_summary]:cursor-pointer">
        <summary className="flex items-center justify-between gap-4 px-4 py-2.5">
          <span className="font-semibold">
            {title} <small className="font-normal text-slate-500">({t('partners.statement.count', { count: lines.length })})</small>
          </span>
          <strong>{money(total)}</strong>
        </summary>
        {note && <p className="px-4 pb-2 text-xs text-slate-500">{note}</p>}
        {lines.length === 0 ? (
          <p className="px-4 pb-3 text-sm text-slate-400">{t('partners.statement.none')}</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {lines.map((l) => (
                <tr key={`${l.ref_type}-${l.ref_id}`} className="border-t border-slate-100">
                  <td className="whitespace-nowrap px-4 py-2 text-slate-500">{formatDate(l.date)}</td>
                  <td className="px-2 py-2">
                    {t(`partners.statement.ref.${l.ref_type}`, { id: l.ref_id, name: l.notes ?? '' })}
                    {/* فواتير الشراء والتسوية بين الشريكين: الاسم جوه العنوان، فمش بنكرره */}
                    {l.notes && !['purchase', 'joint_purchase', 'pair'].includes(l.ref_type) && <small className="block text-slate-500">{l.notes}</small>}
                  </td>
                  <td className={clsx('whitespace-nowrap px-4 py-2 text-end font-semibold', l.amount < 0 && 'text-rose-600')}>{signed(l.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </details>
    )
  }
}
