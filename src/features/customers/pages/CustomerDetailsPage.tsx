import { ArrowRight, Eye, HandCoins, Trash2, WalletCards } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { customerLabel } from '@/shared/utils/partyName'
import { Link, useParams } from 'react-router-dom'
import type { Sale, SalePayment, SaleRefund } from '@shared/types'
import { Pagination } from '@/shared/components/data/Pagination'
import { fromSale } from '@/shared/components/invoice/invoice.types'
import type { InvoiceDocData } from '@/shared/components/invoice/invoice.types'
import { InvoiceViewer } from '@/shared/components/invoice/InvoiceViewer'
import { grossPaid, SalePaidCell } from '@/shared/components/invoice/SalePaidCell'
import { Button, buttonClass, DataTable, PageHeader, PaymentStatusBadge, RowActions, StatCard } from '@/shared/components/ui'
import type { Column } from '@/shared/components/ui'
import { useConfirmDelete } from '@/shared/hooks/useConfirmDelete'
import { usePagination } from '@/shared/hooks/usePagination'
import { useQuery } from '@/shared/hooks/useQuery'
import { useToast } from '@/shared/toast/ToastProvider'
import { formatDate, formatMoney } from '@/shared/utils/format'
import { salesApi } from '../../sales'
import { customersApi } from '../api/customers.api'
import { CollectDialog } from '../components/CollectDialog'
import type { CollectValues } from '../components/CollectDialog'

/** كشف حساب عميل: فواتيره والمدفوع والمتبقي، وتحصيل مبلغ، ودفعاته السابقة */
export default function CustomerDetailsPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const toast = useToast()
  const customerId = Number(useParams().id)
  const { data: statement, reload } = useQuery(() => customersApi.statement({ id: customerId }), [customerId])
  const [collect, setCollect] = useState<{ sale: Sale | null; fromCredit?: boolean } | null>(null) // sale = null: تحصيل على العميل كله، fromCredit: من رصيده
  const [invoice, setInvoice] = useState<InvoiceDocData | null>(null)
  const salesPage = usePagination(statement?.sales ?? [])
  const paymentsPage = usePagination(statement?.payments ?? [])

  const money = (v: number) => formatMoney(v, lang)

  async function submitCollect(values: CollectValues) {
    await customersApi.collect({ ...(collect?.sale ? { sale_id: collect.sale.id } : { customer_id: customerId }), ...(collect?.fromCredit ? { from_credit: true } : {}), ...values })
    toast.success(t('toast.collected', { amount: money(Number(values.amount)) }))
    setCollect(null)
    reload()
  }

  async function viewInvoice(sale: Sale) {
    const full = await salesApi.get({ id: sale.id })
    if (full) setInvoice(fromSale(full))
  }

  const { ask, dialog } = useConfirmDelete<SalePayment>(
    async (payment) => {
      await customersApi.removePayment({ id: payment.id })
      toast.success(t('toast.paymentDeleted'))
      reload()
    },
    { getName: (p) => `${money(p.amount)} — #${p.sale_id} — ${formatDate(p.payment_date)}`, note: t('customers.deletePaymentNote') }
  )

  if (!statement) return <p className="p-10 text-center text-slate-500">{t('common.loading')}</p>
  const { customer, totals } = statement

  const salesColumns: Column<Sale>[] = [
    { key: 'id', header: t('details.invoice'), cell: (s) => <Button variant="link" onClick={() => viewInvoice(s)}>#{s.id}</Button> },
    { key: 'date', header: t('common.date'), cell: (s) => formatDate(s.sale_date) },
    { key: 'total', header: t('common.total'), cell: (s) => money(s.total) },
    { key: 'returns', header: t('customers.returns'), cell: (s) => (s.returns_total > 0 ? money(s.returns_total) : '') },
    { key: 'paid', header: t('invoice.paid'), cell: (s) => <SalePaidCell sale={s} /> },
    { key: 'remaining', header: t('invoice.remaining'), cell: (s) => <strong className={s.remaining > 0 ? 'text-rose-600' : 'text-slate-400'}>{money(s.remaining)}</strong> },
    { key: 'status', header: t('payment.status'), cell: (s) => <PaymentStatusBadge paid={grossPaid(s)} remaining={s.remaining} /> },
    {
      key: 'actions',
      header: '',
      cell: (s) => (
        <RowActions>
          <Button size="sm" icon={Eye} onClick={() => viewInvoice(s)}>{t('common.view')}</Button>
          {s.remaining > 0 && <Button size="sm" variant="primary" icon={HandCoins} onClick={() => setCollect({ sale: s })}>{t('customers.collect')}</Button>}
        </RowActions>
      )
    }
  ]

  const paymentColumns: Column<SalePayment>[] = [
    { key: 'date', header: t('common.date'), cell: (p) => formatDate(p.payment_date) },
    { key: 'invoice', header: t('details.invoice'), cell: (p) => `#${p.sale_id}` },
    { key: 'amount', header: t('customers.amount'), cell: (p) => <strong className="text-green-700">{money(p.amount)}</strong> },
    { key: 'notes', header: t('common.notes'), cell: (p) => [p.from_credit ? t('customers.fromCredit') : null, p.notes].filter(Boolean).join(' · ') },
    { key: 'actions', header: '', cell: (p) => <Button size="sm" variant="danger" icon={Trash2} onClick={() => ask(p)}>{t('common.delete')}</Button> }
  ]

  const refundColumns: Column<SaleRefund>[] = [
    { key: 'date', header: t('common.date'), cell: (r) => formatDate(r.refund_date) },
    { key: 'invoice', header: t('details.invoice'), cell: (r) => `#${r.sale_id}` },
    { key: 'amount', header: t('customers.amount'), cell: (r) => <strong>{money(r.amount)}</strong> },
    { key: 'kind', header: t('common.notes'), cell: (r) => (r.kind === 'cash' ? t('customers.refundCash') : t('customers.refundCredit', { id: r.used_in_sale_id })) }
  ]
  const canUseCredit = totals.credit > 0 && totals.remaining > 0

  return (
    <>
      <PageHeader title={customerLabel(customer.name, customer.is_partner, t)}>
        {canUseCredit && (
          <Button icon={WalletCards} onClick={() => setCollect({ sale: null, fromCredit: true })}>{t('customers.useCredit')}</Button>
        )}
        {totals.remaining > 0 && (
          <Button variant="primary" icon={HandCoins} onClick={() => setCollect({ sale: null })}>{t('customers.collect')}</Button>
        )}
        <Link className={buttonClass('secondary')} to="/customers"><ArrowRight className="h-4 w-4" aria-hidden="true" />{t('customers.back')}</Link>
      </PageHeader>
      {customer.phone && <p className="-mt-2 mb-4 text-slate-500" dir="ltr">{customer.phone}</p>}

      <div className="mb-6 grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3.5">
        <StatCard label={t('customers.totalInvoices')} value={money(totals.total)} tone="indigo" />
        <StatCard label={t('invoice.paid')} value={money(totals.paid)} tone="green" />
        <StatCard label={t('customers.returns')} value={money(totals.returns)} />
        {totals.refunded > 0 && <StatCard label={t('invoice.refunded')} value={money(totals.refunded)} tone="slate" />}
        <StatCard label={t('invoice.remaining')} value={money(totals.remaining)} tone={totals.remaining > 0 ? 'teal' : 'slate'} big />
        {totals.credit > 0 && <StatCard label={t('customers.credit')} value={money(totals.credit)} sub={t('customers.creditSub')} tone="green" big />}
      </div>

      <h2 className="mb-3">{t('customers.invoices')}</h2>
      <DataTable columns={salesColumns} rows={salesPage.pageRows} rowKey={(s) => s.id} />
      <Pagination {...salesPage} />

      <h2 className="mb-3 mt-7">{t('customers.payments')}</h2>
      <DataTable columns={paymentColumns} rows={paymentsPage.pageRows} rowKey={(p) => p.id} emptyText={t('customers.noPayments')} />
      <Pagination {...paymentsPage} />

      {statement.refunds.length > 0 && (
        <>
          <h2 className="mb-3 mt-7">{t('customers.refunds')}</h2>
          <DataTable columns={refundColumns} rows={statement.refunds} rowKey={(r) => r.id} emptyText={t('customers.noRefunds')} />
        </>
      )}

      {collect && (
        <CollectDialog
          title={collect.fromCredit ? t('customers.useCreditTitle') : undefined}
          subject={collect.sale ? `${t('details.invoice')} #${collect.sale.id}` : customer.name}
          remaining={collect.fromCredit ? Math.min(totals.credit, totals.remaining) : collect.sale ? collect.sale.remaining : totals.remaining}
          perCustomer={!collect.sale}
          onSubmit={submitCollect}
          onClose={() => setCollect(null)}
        />
      )}
      {invoice && <InvoiceViewer data={invoice} onClose={() => setInvoice(null)} />}
      {dialog}
    </>
  )
}
