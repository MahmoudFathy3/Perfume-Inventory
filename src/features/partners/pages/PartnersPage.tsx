import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { PartnerAccount, PartnerPayment, PartnerPaymentInput } from '@shared/types'
import { EmptyState, Modal, PageHeader, StatCard } from '@/shared/components/ui'
import { useConfirmDelete } from '@/shared/hooks/useConfirmDelete'
import { useQuery } from '@/shared/hooks/useQuery'
import { useToast } from '@/shared/toast/ToastProvider'
import { formatMoney } from '@/shared/utils/format'
import { DateRangeFilter } from '../../dashboard'
import type { DateRange } from '../../dashboard'
import { useWorkspaces } from '../../workspaces'
import { partnersApi } from '../api/partners.api'
import { PartnerAccountsTable } from '../components/PartnerAccountsTable'
import { PartnerSalesTable } from '../components/PartnerSalesTable'
import { PaymentForm } from '../components/PaymentForm'
import { PaymentsTable } from '../components/PaymentsTable'

/** حسابات الشركاء في الشراكة النشطة + التسويات. مش بتظهر في المخزون الفعلي. */
export default function PartnersPage() {
  const { active } = useWorkspaces()
  return active.kind === 'partnership' ? <Accounts /> : <PersonalNotice />
}

function PersonalNotice() {
  const { t } = useTranslation()
  return (
    <>
      <PageHeader title={t('partners.title')} />
      <EmptyState>{t('partners.personalNote')}</EmptyState>
    </>
  )
}

function Accounts() {
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const { active, label } = useWorkspaces()
  const ledger = useQuery(() => partnersApi.ledger(), [])
  const [settling, setSettling] = useState<PartnerAccount | null>(null)
  const [range, setRange] = useState<DateRange>({ from: '', to: '' })
  const sales = useQuery(() => partnersApi.sales({ from: range.from || null, to: range.to || null }), [range.from, range.to])
  const { reload } = ledger

  async function pay(payload: PartnerPaymentInput) {
    await partnersApi.pay(payload)
    toast.success(t('toast.created'))
    setSettling(null)
    reload()
  }

  const { ask, dialog } = useConfirmDelete<PartnerPayment>(
    async (row) => {
      await partnersApi.removePayment({ id: row.id })
      toast.success(t('toast.deleted'))
      reload()
    },
    { getName: (row) => `${row.partner_name} — ${formatMoney(Math.abs(row.amount), i18n.language)}` }
  )

  const data = ledger.data
  return (
    <>
      <PageHeader title={`${t('partners.title')} — ${label(active)}`} />
      {data && (
        <>
          <div className="mb-4 grid grid-cols-3 gap-4">
            <StatCard label={t('partners.partnershipProfit')} value={formatMoney(data.profit, i18n.language)} tone="green" big />
          </div>
          <PartnerAccountsTable rows={data.accounts} onSettle={setSettling} />
          <p className="mt-3 text-sm text-slate-500">{t('partners.formula')}</p>

          <h2 className="mb-3 mt-6">{t('partners.salesTitle')}</h2>
          <DateRangeFilter range={range} onChange={setRange} />
          <div className="mt-3">{sales.data && <PartnerSalesTable rows={sales.data} />}</div>

          <h2 className="mb-3 mt-6">{t('partners.payments')}</h2>
          <PaymentsTable rows={data.payments} onDelete={ask} />
        </>
      )}
      {settling && (
        <Modal title={t('partners.settle')} onClose={() => setSettling(null)}>
          <PaymentForm account={settling} onSubmit={pay} onCancel={() => setSettling(null)} />
        </Modal>
      )}
      {dialog}
    </>
  )
}
