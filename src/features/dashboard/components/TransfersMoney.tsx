import { HandCoins } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import type { Transfer, TransferMoneyLine } from '@shared/types'
import { CollectDialog } from '@/features/customers'
import type { CollectValues } from '@/features/customers'
import { transferRemaining, transfersApi } from '@/features/transfers'
import { useWorkspaces } from '@/features/workspaces'
import { Button, buttonClass, Card, StatCard } from '@/shared/components/ui'
import { useQuery } from '@/shared/hooks/useQuery'
import { useToast } from '@/shared/toast/ToastProvider'
import { formatDate, formatMoney } from '@/shared/utils/format'

/**
 * فلوس تحويلات "بيع بسعر" للمخزن النشط: اللي ليه (باع لمخزن تاني) واللي عليه (اشترى من مخزن تاني)،
 * ولكل مخزن تاني لوحده، وأقدم التحويلات اللي لسه عليها فلوس مع زرار تحصيل / دفع.
 * مبتظهرش لو مفيش تحويلات بيع خالص.
 */
export function TransfersMoney() {
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const { active, workspaces, label } = useWorkspaces()
  const { data, reload } = useQuery(() => transfersApi.money(), [active.id])
  const [paying, setPaying] = useState<Transfer | null>(null)

  if (!data || data.receivable.total + data.payable.total === 0) return null
  const money = (v: number) => formatMoney(v, i18n.language)
  const nameOf = (id: number) => {
    const ws = workspaces.find((w) => w.id === id)
    return ws ? label(ws) : `#${id}`
  }
  const sub = (line: TransferMoneyLine) =>
    `${t('dashboard.paidOf', { paid: money(line.paid), total: money(line.total) })}${line.unpaid_count ? ` · ${t('dashboard.unpaidTransfers', { count: line.unpaid_count })}` : ''}`

  async function pay(row: Transfer, values: CollectValues) {
    await transfersApi.pay({ transfer_id: row.id, ...values })
    toast.success(t('toast.saved'))
    setPaying(null)
    reload()
  }

  return (
    <section className="mt-7">
      <h2 className="mb-3">{t('dashboard.transfersMoney')} <small className="font-normal text-slate-500">— {t('dashboard.transfersMoneyNote')}</small></h2>
      <div className="grid gap-3.5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div className="grid content-start gap-3.5">
          <div className="grid gap-3.5 sm:grid-cols-2">
            <StatCard label={t('dashboard.owedTo', { name: label(active) })} value={money(data.receivable.remaining)} sub={sub(data.receivable)} tone="green" big />
            <StatCard label={t('dashboard.owedBy', { name: label(active) })} value={money(data.payable.remaining)} sub={sub(data.payable)} tone="indigo" big />
          </div>
          {data.stores.length > 0 && (
            <Card className="!p-0">
              <h3 className="border-b border-slate-200 px-4 py-3">{t('dashboard.byStore')}</h3>
              <ul className="divide-y divide-slate-100 text-sm">
                {data.stores.map((s) => (
                  <li key={s.workspace_id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-4 px-4 py-2.5">
                    <strong className="truncate">{nameOf(s.workspace_id)}</strong>
                    <span className="text-end">
                      <small className="block text-slate-500">{t('dashboard.owedTo', { name: label(active) })}</small>
                      <span className="font-bold text-green-700">{money(s.receivable.remaining)}</span>
                    </span>
                    <span className="text-end">
                      <small className="block text-slate-500">{t('dashboard.owedBy', { name: label(active) })}</small>
                      <span className="font-bold text-indigo-600">{money(s.payable.remaining)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <Card className="!p-0">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <h3>{t('dashboard.unpaidList')}</h3>
            <Link to="/transfers" className={buttonClass('ghost', 'sm')}>{t('dashboard.viewTransfers')}</Link>
          </div>
          {data.unpaid.length === 0 ? (
            <p className="px-4 py-8 text-center text-slate-500">{t('dashboard.allTransfersPaid')}</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {data.unpaid.map((row) => {
                const ours = row.from_workspace_id === active.id
                return (
                  <li key={row.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5">
                    <span className="min-w-0">
                      <strong>#{row.id}</strong> · {formatDate(row.transfer_date)}
                      <small className="block truncate text-slate-500">
                        {nameOf(row.from_workspace_id)} ← {nameOf(row.to_workspace_id)}{row.partner_name ? ` · ${row.partner_name}` : ''}
                      </small>
                    </span>
                    <span className="flex items-center gap-3">
                      <strong className={ours ? 'text-green-700' : 'text-indigo-600'}>{money(transferRemaining(row))}</strong>
                      {row.sale_id ? (
                        <small className="text-slate-500">{t('transfers.fromSale', { id: row.sale_id })}</small>
                      ) : (
                        <Button size="sm" variant="primary" icon={HandCoins} onClick={() => setPaying(row)}>{t(ours ? 'transfers.collect' : 'transfers.payOut')}</Button>
                      )}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>

      {paying && (
        <CollectDialog
          title={t(paying.from_workspace_id === active.id ? 'transfers.collectTitle' : 'transfers.payTitle', { id: paying.id })}
          subject={`${nameOf(paying.from_workspace_id)} ← ${nameOf(paying.to_workspace_id)}${paying.partner_name ? ` · ${paying.partner_name}` : ''}`}
          remaining={transferRemaining(paying)}
          note={t('transfers.paymentNote')}
          submitLabel={t('transfers.confirmPayment')}
          onSubmit={(values) => pay(paying, values)}
          onClose={() => setPaying(null)}
        />
      )}
    </section>
  )
}
