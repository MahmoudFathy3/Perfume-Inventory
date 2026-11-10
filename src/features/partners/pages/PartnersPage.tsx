import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { ArrowLeftRight } from 'lucide-react'
import type { PartnerAccount, PartnerPayment, PartnerPaymentInput, PartnerTransferInput } from '@shared/types'
import { Button, EmptyState, Modal, PageHeader, StatCard } from '@/shared/components/ui'
import { useConfirmDelete } from '@/shared/hooks/useConfirmDelete'
import { useQuery } from '@/shared/hooks/useQuery'
import { useToast } from '@/shared/toast/ToastProvider'
import { formatMoney } from '@/shared/utils/format'
import { DateRangeFilter } from '@/shared/components/data/DateRangeFilter'
import type { DateRange } from '@/shared/components/data/DateRangeFilter'
import { useWorkspaces } from '../../workspaces'
import { partnersApi } from '../api/partners.api'
import { PartnerAccountsTable } from '../components/PartnerAccountsTable'
import { PartnerSalesTable } from '../components/PartnerSalesTable'
import { PartnerStatementModal } from '../components/PartnerStatementModal'
import { PaymentForm } from '../components/PaymentForm'
import { PartnerTransferForm } from '../components/PartnerTransferForm'
import { PaymentsTable } from '../components/PaymentsTable'

const PERSONAL_ID = 1

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
  const { active, label, activate } = useWorkspaces()
  const navigate = useNavigate()
  const ledger = useQuery(() => partnersApi.ledger(), [])
  const [settling, setSettling] = useState<PartnerAccount | null>(null)
  const [details, setDetails] = useState<PartnerAccount | null>(null)
  const [transferring, setTransferring] = useState(false)
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

  // كشف حساب الشريك في المخزون الفعلي: بنبدّل على المخزون الفعلي الأول (العميل تبعه)
  async function openStoreAccount(customerId: number) {
    try {
      await activate(PERSONAL_ID)
      navigate(`/customers/${customerId}`)
    } catch (e) {
      toast.fail(e)
    }
  }

  async function transfer(payload: PartnerTransferInput) {
    await partnersApi.transfer(payload)
    toast.success(t('toast.created'))
    setTransferring(false)
    reload()
  }

  const data = ledger.data
  return (
    <>
      <PageHeader title={`${t('partners.title')} — ${label(active)}`}>
        {(data?.accounts.length ?? 0) >= 2 && (
          <Button icon={ArrowLeftRight} onClick={() => setTransferring(true)}>{t('partners.transferTitle')}</Button>
        )}
      </PageHeader>
      {data && (
        <>
          <div className="mb-4 grid grid-cols-3 gap-4">
            <StatCard label={t('partners.partnershipProfit')} value={formatMoney(data.profit, i18n.language)} tone="green" big />
          </div>
          <PartnerAccountsTable rows={data.accounts} onSettle={setSettling} onDetails={setDetails} onOpenStoreAccount={openStoreAccount} />
          <p className="mt-3 text-sm text-slate-500">{t('partners.formula')}</p>
          <p className="mt-1 text-sm text-slate-500">{t('partners.storeNote')}</p>

          <h2 className="mb-1 mt-6">{t('partners.salesTitle')}</h2>
          <p className="mb-3 text-sm text-slate-500">{t('partners.salesNote')}</p>
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
      {details && <PartnerStatementModal partnerId={details.partner.id} name={details.partner.name} onClose={() => setDetails(null)} />}
      {transferring && data && (
        <Modal title={t('partners.transferTitle')} onClose={() => setTransferring(false)}>
          <PartnerTransferForm accounts={data.accounts} onSubmit={transfer} onCancel={() => setTransferring(false)} />
        </Modal>
      )}
      {dialog}
    </>
  )
}
