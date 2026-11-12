import clsx from 'clsx'
import { HandCoins, Lock, LockOpen } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ClosingUnpaid, MonthlyClosing, PartnerClosingRow } from '@shared/types'
import { ExportMenu } from '@/shared/components/data/ExportMenu'
import { Alert, Badge, Button, Field, Input, Modal, Segmented, StatCard } from '@/shared/components/ui'
import { useQuery } from '@/shared/hooks/useQuery'
import { useToast } from '@/shared/toast/ToastProvider'
import { formatDate, formatMoney, todayString } from '@/shared/utils/format'
import { partnersApi } from '../api/partners.api'

/** الشهر الحالي YYYY-MM بالتوقيت المحلي */
export const thisMonth = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** اسم الشهر بلغة التطبيق (يناير 2030) */
export const monthName = (month: string, lang: string) => new Date(`${month}-01T00:00:00`).toLocaleDateString(lang, { month: 'long', year: 'numeric' })

interface MonthlyClosingModalProps {
  /** الشهر (YYYY-MM) أو اليوم (YYYY-MM-DD) اللي يفتح عليه (الافتراضي الشهر الحالي) */
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
  // شهر أو يوم: نفس الجدول ونفس التسوية والقفل، بس ليوم واحد
  const [mode, setMode] = useState<'month' | 'day'>(initialMonth?.length === 10 ? 'day' : 'month')
  const [month, setMonth] = useState(initialMonth?.length === 7 ? initialMonth : thisMonth())
  const [day, setDay] = useState(initialMonth?.length === 10 ? initialMonth : todayString())
  const key = mode === 'day' ? day : month
  const [confirming, setConfirming] = useState<'close' | 'reopen' | 'settle' | null>(null)
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const { data, reload } = useQuery(
    () => (!key ? Promise.resolve(null) : mode === 'day' ? partnersApi.dayClosing({ day: key }) : partnersApi.closing({ month: key })),
    [mode, key]
  )
  const money = (v: number) => formatMoney(v, i18n.language)

  /** النص بتاع اليوم لو موجود (partners.closing.day.*)، وإلا بتاع الشهر */
  const k = (name: string) => (mode === 'day' && i18n.exists(`partners.closing.day.${name}`) ? `partners.closing.day.${name}` : `partners.closing.${name}`)
  /** اسم الفترة: يناير 2030، أو التاريخ لليوم */
  const periodName = (value: string) => (value.length === 10 ? formatDate(value) : monthName(value, i18n.language))

  function pickMonth(value: string) {
    if (mode === 'day') setDay(value)
    else setMonth(value)
    setConfirming(null)
    setNotes('')
  }

  async function run(action: 'close' | 'reopen' | 'settle') {
    setBusy(true)
    try {
      const settleNotes = notes || t('partners.closing.settleNote', { month: periodName(key) })
      if (mode === 'day') {
        if (action === 'close') await partnersApi.closeDay({ day, notes })
        else if (action === 'settle') await partnersApi.settleDay({ day, notes: settleNotes })
        else await partnersApi.reopenDay({ day })
      } else if (action === 'close') await partnersApi.closeMonth({ month, notes })
      else if (action === 'settle') await partnersApi.settleMonth({ month, notes: settleNotes })
      else await partnersApi.reopenMonth({ month })
      toast.success(t(k(action === 'close' ? 'closedToast' : action === 'settle' ? 'settledToast' : 'reopenedToast')))
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
    [t(k('opening')), (r) => r.opening, t(k('openingHint'))],
    [t('partners.profitShare'), (r) => r.profit_share],
    [t('partners.sold'), (r) => r.sold],
    [t('partners.paidOut'), (r) => r.paid_out],
    [t(k('settled')), (r) => r.settled, t('partners.closing.settledHint')]
  ]

  return (
    <Modal title={t(mode === 'day' ? 'partners.closing.day.title' : 'partners.closing.title')} onClose={onClose} wide>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <Segmented
              value={mode}
              onChange={(value) => {
                setMode(value)
                setConfirming(null)
                setNotes('')
              }}
              options={[
                { value: 'month', label: t('partners.closing.modeMonth') },
                { value: 'day', label: t('partners.closing.modeDay') }
              ]}
            />
            <Field label={t(mode === 'day' ? 'partners.closing.day.label' : 'partners.closing.month')} className="!mb-0">
              {mode === 'day' ? (
                <Input type="date" value={day} max={todayString()} onChange={(e) => pickMonth(e.target.value)} className="w-48" />
              ) : (
                <Input type="month" value={month} onChange={(e) => pickMonth(e.target.value)} className="w-48" />
              )}
            </Field>
          </div>
          {data && <ExportMenu target={{ dataset: 'partner_closing', month: key }} />}
        </div>

        {data && (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="font-bold">{periodName(data.month)}</h3>
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
            <p className="text-sm text-slate-500">{t(k('formula'))}</p>
            {/* اليوم: فواتير اليوم اللي لسه عليها فلوس قبل التسوية (للعلم، مبتمنعش القفل) */}
            {data.period === 'day' && data.unpaid.length > 0 && unpaidList(data.unpaid)}
            {settleSection(data)}
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
              <th className="px-3 py-2.5 text-end">{t(k('closing'))}</th>
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
  /** تسوية الكل: كل شريك بياخد الباقي له (أو بيدفع اللي عليه) بتاريخ آخر الشهر، فالباقي بيبقى صفر */
  function settleSection(c: MonthlyClosing) {
    // due = اللي لسه محتاج يتسوّى (الباقي − تحويلات اتدفعت بعد الفترة)
    const dueOf = (r: PartnerClosingRow) => r.due ?? r.closing
    const due = c.rows.filter((r) => Math.abs(dueOf(r)) >= 0.005)
    if (c.closed || due.length === 0) return null
    return (
      <section className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4">
        <p className="text-sm text-indigo-900">{t(k('settleIntro'))}</p>
        {confirming === 'settle' ? (
          <div className="mt-3 flex flex-col gap-3">
            <ul className="divide-y divide-indigo-100 rounded-lg bg-white text-sm">
              {due.map((r) => (
                <li key={r.partner.id} className="flex justify-between gap-3 px-3 py-2">
                  <span>{r.partner.name}</span>
                  <strong className={dueOf(r) >= 0 ? 'text-green-700' : 'text-rose-600'}>
                    {t(dueOf(r) >= 0 ? 'partners.closing.settleTakes' : 'partners.closing.settlePays', { amount: money(Math.abs(dueOf(r))) })}
                  </strong>
                </li>
              ))}
            </ul>
            <Alert tone="info">{t(k('settleHow'))}</Alert>
            <Field label={t('partners.closing.notes')}>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('partners.closing.settleNote', { month: periodName(c.month) })} />
            </Field>
            <div className="flex gap-2">
              <Button variant="primary" icon={HandCoins} disabled={busy} onClick={() => void run('settle')}>{t('partners.closing.confirmSettle')}</Button>
              <Button onClick={() => setConfirming(null)}>{t('common.cancel')}</Button>
            </div>
          </div>
        ) : (
          <Button className="mt-3" icon={HandCoins} onClick={() => setConfirming('settle')}>{t('partners.closing.settleAll')}</Button>
        )}
      </section>
    )
  }

  function lockSection(c: MonthlyClosing) {
    if (c.closed) {
      return (
        <section className="rounded-xl border border-green-200 bg-green-50/60 p-4">
          <p className="text-sm text-green-900">{t(k('closedNote'))}</p>
          {confirming === 'reopen' ? (
            <>
              <Alert tone="warning">{t(k('reopenWarning'))}</Alert>
              <div className="flex gap-2">
                <Button variant="primary" icon={LockOpen} disabled={busy} onClick={() => void run('reopen')}>{t('partners.closing.confirmReopen')}</Button>
                <Button onClick={() => setConfirming(null)}>{t('common.cancel')}</Button>
              </div>
            </>
          ) : (
            <Button className="mt-3" icon={LockOpen} onClick={() => setConfirming('reopen')}>{t(k('reopen'))}</Button>
          )}
        </section>
      )
    }

    if (!c.ended) return <Alert tone="info">{t(k('notEnded'))}</Alert>
    // الشهر لازم كله مدفوع، واليوم لازم الشركاء يتسوّوا الأول (الآجل في اليوم عادي)
    if (c.period === 'month' && c.unpaid.length > 0) return unpaidList(c.unpaid)
    if (c.rows.some((r) => Math.abs(r.due ?? r.closing) >= 0.005)) return <Alert tone="warning">{t(k('settleFirst'))}</Alert>

    return (
      <section className="rounded-xl border border-slate-200 p-4">
        <p className="text-sm text-slate-600">{t(k('readyNote'))}</p>
        {confirming === 'close' ? (
          <div className="mt-3 flex flex-col gap-3">
            <Alert tone="warning">{t(k('closeWarning'))}</Alert>
            <Field label={t('partners.closing.notes')}>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('partners.closing.notesPlaceholder')} />
            </Field>
            <div className="flex gap-2">
              <Button variant="primary" icon={Lock} disabled={busy} onClick={() => void run('close')}>{t('partners.closing.confirmClose')}</Button>
              <Button onClick={() => setConfirming(null)}>{t('common.cancel')}</Button>
            </div>
          </div>
        ) : (
          <Button className="mt-3" variant="primary" icon={Lock} onClick={() => setConfirming('close')}>{t(k('close'))}</Button>
        )}
      </section>
    )
  }

  /** اللي لسه عليه فلوس في الشهر (لازم يتدفع قبل التقفيل) */
  function unpaidList(rows: ClosingUnpaid[]) {
    const total = rows.reduce((sum, r) => sum + r.remaining, 0)
    return (
      <section className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
        <p className="font-bold text-amber-900">{t(k('unpaidTitle'), { count: rows.length, amount: money(total) })}</p>
        <p className="mb-3 text-sm text-amber-800">{t(k('unpaidNote'))}</p>
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
