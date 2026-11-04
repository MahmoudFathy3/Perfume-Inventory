import clsx from 'clsx'
import { Lock, LockOpen } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ClosingUnpaid, MonthlyClosing, PartnerClosingRow } from '@shared/types'
import { ExportMenu } from '@/shared/components/data/ExportMenu'
import { Alert, Badge, Button, Field, Input, Modal, StatCard } from '@/shared/components/ui'
import { useQuery } from '@/shared/hooks/useQuery'
import { useToast } from '@/shared/toast/ToastProvider'
import { formatDate, formatMoney } from '@/shared/utils/format'
import { partnersApi } from '../api/partners.api'

/** الشهر الحالي YYYY-MM بالتوقيت المحلي */
export const thisMonth = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** اسم الشهر بلغة التطبيق (يناير 2030) */
export const monthName = (month: string, lang: string) => new Date(`${month}-01T00:00:00`).toLocaleDateString(lang, { month: 'long', year: 'numeric' })

interface MonthlyClosingModalProps {
  /** الشهر اللي يفتح عليه (الافتراضي الشهر الحالي) */
  initialMonth?: string
  /** بعد التقفيل أو الفتح (علشان جدول الشهور المقفولة يتحدّث) */
  onChanged: () => void
  onClose: () => void
}

/**
 * تقفيل الشهر بين الشركاء: أرقام الشهر وحساب كل شريك فيه.
 * الشهر بيتقفل لما يكون خلص وكل حاجة فيه مدفوعة، وبعد كده أرقامه بتتحفظ ومفيش تعديل في أي حاجة بتاريخ فيه لحد ما يتفتح تاني.
 */
export function MonthlyClosingModal({ initialMonth, onChanged, onClose }: MonthlyClosingModalProps) {
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const [month, setMonth] = useState(initialMonth ?? thisMonth)
  const [confirming, setConfirming] = useState<'close' | 'reopen' | null>(null)
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const { data, reload } = useQuery(() => (month ? partnersApi.closing({ month }) : Promise.resolve(null)), [month])
  const money = (v: number) => formatMoney(v, i18n.language)

  function pickMonth(value: string) {
    setMonth(value)
    setConfirming(null)
    setNotes('')
  }

  async function run(action: 'close' | 'reopen') {
    setBusy(true)
    try {
      if (action === 'close') await partnersApi.closeMonth({ month, notes })
      else await partnersApi.reopenMonth({ month })
      toast.success(t(action === 'close' ? 'partners.closing.closedToast' : 'partners.closing.reopenedToast'))
      setConfirming(null)
      setNotes('')
      reload()
      onChanged()
    } catch (e) {
      toast.fail(e)
    } finally {
      setBusy(false)
    }
  }

  // الأعمدة: [العنوان، القيمة، تلميح]
  const columns: [string, (r: PartnerClosingRow) => number, string?][] = [
    [t('partners.closing.opening'), (r) => r.opening, t('partners.closing.openingHint')],
    [t('partners.profitShare'), (r) => r.profit_share],
    [t('partners.sold'), (r) => r.sold],
    [t('partners.paidOut'), (r) => r.paid_out],
    [t('partners.closing.settled'), (r) => r.settled, t('partners.closing.settledHint')]
  ]

  return (
    <Modal title={t('partners.closing.title')} onClose={onClose} wide>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <Field label={t('partners.closing.month')}>
            <Input type="month" value={month} onChange={(e) => pickMonth(e.target.value)} className="w-48" />
          </Field>
          {data && <ExportMenu target={{ dataset: 'partner_closing', month }} />}
        </div>

        {data && (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="font-bold">{monthName(data.month, i18n.language)}</h3>
              {data.closed ? (
                <Badge tone="green">{t('partners.closing.closedBadge', { date: formatDate(data.closed.closed_at.slice(0, 10)) })}</Badge>
              ) : (
                <Badge tone="amber">{t('partners.closing.openBadge')}</Badge>
              )}
              {data.closed?.notes && <span className="text-sm text-slate-500">{data.closed.notes}</span>}
            </div>

            <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label={t('dashboard.salesPeriod')} value={money(data.sales.total)} sub={t('dashboard.invoicesSub', { count: data.sales.count })} tone="indigo" />
              <StatCard label={t('dashboard.actualProfit')} value={money(data.profit)} sub={t('partners.closing.returnsSub', { amount: money(data.sales.returns) })} tone="green" />
              <StatCard label={t('dashboard.expenses')} value={money(data.expenses)} sub={t('partners.closing.expensesSub')} tone="slate" />
              <StatCard label={t('dashboard.netProfit')} value={money(data.net_profit)} sub={t('partners.closing.netSub')} tone="green" big />
            </div>

            {partnersTable(data)}
            <p className="text-sm text-slate-500">{t('partners.closing.formula')}</p>
            {lockSection(data)}
          </>
        )}
      </div>
    </Modal>
  )

  function partnersTable(c: MonthlyClosing) {
    if (c.rows.length === 0) return null
    return (
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2.5 text-start">{t('partners.closing.partner')}</th>
              {columns.map(([label, , hint]) => (
                <th key={label} className="px-3 py-2.5 text-end" title={hint}>{label}</th>
              ))}
              <th className="px-3 py-2.5 text-end">{t('partners.closing.closing')}</th>
              <th className="px-3 py-2.5 text-end text-slate-400" title={t('partners.closing.capitalHint')}>{t('partners.capital')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {c.rows.map((r) => (
              <tr key={r.partner.id}>
                <td className="px-3 py-2.5 font-bold">{r.partner.name} <small className="font-normal text-slate-500">({r.partner.share_percent}%)</small></td>
                {columns.map(([label, value]) => (
                  <td key={label} className="px-3 py-2.5 text-end tabular-nums">{money(value(r))}</td>
                ))}
                <td className={clsx('px-3 py-2.5 text-end font-bold tabular-nums', r.closing >= 0 ? 'text-green-700' : 'text-rose-600')}>{money(r.closing)}</td>
                <td className="px-3 py-2.5 text-end tabular-nums text-slate-400">{money(r.capital)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  /** التقفيل / الفتح: الشهر المقفول بيتفتح بتأكيد، والمفتوح بيتقفل لو خلص وكله مدفوع */
  function lockSection(c: MonthlyClosing) {
    if (c.closed) {
      return (
        <section className="rounded-xl border border-green-200 bg-green-50/60 p-4">
          <p className="text-sm text-green-900">{t('partners.closing.closedNote')}</p>
          {confirming === 'reopen' ? (
            <>
              <Alert tone="warning">{t('partners.closing.reopenWarning')}</Alert>
              <div className="flex gap-2">
                <Button variant="primary" icon={LockOpen} disabled={busy} onClick={() => void run('reopen')}>{t('partners.closing.confirmReopen')}</Button>
                <Button onClick={() => setConfirming(null)}>{t('common.cancel')}</Button>
              </div>
            </>
          ) : (
            <Button className="mt-3" icon={LockOpen} onClick={() => setConfirming('reopen')}>{t('partners.closing.reopen')}</Button>
          )}
        </section>
      )
    }

    if (!c.ended) return <Alert tone="info">{t('partners.closing.notEnded')}</Alert>
    if (c.unpaid.length > 0) return unpaidList(c.unpaid)

    return (
      <section className="rounded-xl border border-slate-200 p-4">
        <p className="text-sm text-slate-600">{t('partners.closing.readyNote')}</p>
        {confirming === 'close' ? (
          <div className="mt-3 flex flex-col gap-3">
            <Alert tone="warning">{t('partners.closing.closeWarning')}</Alert>
            <Field label={t('partners.closing.notes')}>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('partners.closing.notesPlaceholder')} />
            </Field>
            <div className="flex gap-2">
              <Button variant="primary" icon={Lock} disabled={busy} onClick={() => void run('close')}>{t('partners.closing.confirmClose')}</Button>
              <Button onClick={() => setConfirming(null)}>{t('common.cancel')}</Button>
            </div>
          </div>
        ) : (
          <Button className="mt-3" variant="primary" icon={Lock} onClick={() => setConfirming('close')}>{t('partners.closing.close')}</Button>
        )}
      </section>
    )
  }

  /** اللي لسه عليه فلوس في الشهر (لازم يتدفع قبل التقفيل) */
  function unpaidList(rows: ClosingUnpaid[]) {
    const total = rows.reduce((sum, r) => sum + r.remaining, 0)
    return (
      <section className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
        <p className="font-bold text-amber-900">{t('partners.closing.unpaidTitle', { count: rows.length, amount: money(total) })}</p>
        <p className="mb-3 text-sm text-amber-800">{t('partners.closing.unpaidNote')}</p>
        <ul className="divide-y divide-amber-100 rounded-lg bg-white text-sm">
          {rows.map((r) => (
            <li key={`${r.type}-${r.id}`} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2">
              <span>
                <Badge tone={r.type === 'sale' ? 'teal' : r.type === 'purchase' ? 'indigo' : 'purple'}>{t(`partners.closing.unpaidTypes.${r.type}`)}</Badge>{' '}
                <strong>#{r.id}</strong> · {formatDate(r.date)}
                {r.party && <span className="text-slate-500"> · {r.party}</span>}
              </span>
              <strong className="text-rose-600">{money(r.remaining)}</strong>
            </li>
          ))}
        </ul>
      </section>
    )
  }
}
