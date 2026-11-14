import { PackageOpen, Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import type { Sale, SaleInput, SaleOrder, SaleWithLines } from '@shared/types'
import { ConfirmActionDialog } from '@/shared/components/data/ConfirmActionDialog'
import { ExportMenu } from '@/shared/components/data/ExportMenu'
import { Pagination } from '@/shared/components/data/Pagination'
import { SearchBar } from '@/shared/components/data/SearchBar'
import { fromSale } from '@/shared/components/invoice/invoice.types'
import type { InvoiceDocData } from '@/shared/components/invoice/invoice.types'
import { InvoicesTable } from '@/shared/components/invoice/InvoicesTable'
import { InvoiceViewer } from '@/shared/components/invoice/InvoiceViewer'
import { grossPaid } from '@/shared/components/invoice/SalePaidCell'
import { SaleForm } from '@/shared/components/invoice/SaleForm'
import { Button, Modal, PageHeader, Segmented } from '@/shared/components/ui'
import { useConfirmDelete } from '@/shared/hooks/useConfirmDelete'
import { usePagedQuery } from '@/shared/hooks/usePagedQuery'
import { useQuery } from '@/shared/hooks/useQuery'
import { useToast } from '@/shared/toast/ToastProvider'
import { formatMoney } from '@/shared/utils/format'
import { customersApi, useCustomers } from '../../customers'
import { DateRangeFilter, FilterGroup } from '@/shared/components/data/DateRangeFilter'
import type { DateRange } from '@/shared/components/data/DateRangeFilter'
import { useItems } from '../../items'
import { useWorkspaces } from '../../workspaces'
import { ordersApi, orderToSale } from '../api/orders.api'
import { salesApi } from '../api/sales.api'
import { ConfirmOrderDialog } from '../components/ConfirmOrderDialog'
import { OrdersTable } from '../components/OrdersTable'
import { useForeignItems } from '../hooks/useForeignItems'
import { useSales } from '../hooks/useSales'

/** sale = فاتورة بيع بتتعدّل، order = طلب تحت التجهيز بيتعدّل، ولا حاجة = فاتورة جديدة (وفيها اختيار تحت التجهيز) */
type FormState = { sale: SaleWithLines | null; order?: number }

/** المبيعات: الفواتير اللي اتباعت، وتبويب "تحت التجهيز" للطلبات اللي لسه ما اتباعتش (مبتتخصمش من المخزون) */
export default function SalesPage() {
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const [search, setSearch] = useState('')
  const { active, label } = useWorkspaces()
  const partners = active.kind === 'partnership' ? active.partners : []
  // ?tab=orders (من كارت المحجوز في الرئيسية) بيفتح على تبويب تحت التجهيز
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState<'sales' | 'orders'>(searchParams.get('tab') === 'orders' ? 'orders' : 'sales')
  const [partnerFilter, setPartnerFilter] = useState('') // '' = كل الشركاء
  const [form, setForm] = useState<FormState | null>(null)
  const [invoice, setInvoice] = useState<InvoiceDocData | null>(null)
  const [confirming, setConfirming] = useState<SaleOrder | null>(null)
  const [toPendingRow, setToPendingRow] = useState<Sale | null>(null) // تأكيد رجوع فاتورة لتحت التجهيز
  const [range, setRange] = useState<DateRange>({ from: '', to: '' })
  const partnerId = partnerFilter ? Number(partnerFilter) : undefined
  const pagination = useSales(search, partnerId, range)
  const orders = usePagedQuery((page) => ordersApi.page({ search, ...range, ...page }), [search, range.from, range.to])
  const ordersCount = useQuery(() => ordersApi.count(), [])
  const { reload } = pagination
  const { items, reload: reloadItems } = useItems('')
  const { customers, reload: reloadCustomers } = useCustomers()
  const { foreign, reload: reloadForeign } = useForeignItems()

  /** أي تغيير في فاتورة بيع أو طلب بيأثر على المخزن (أو المحجوز) والعملاء */
  const refresh = () => {
    reload()
    orders.reload()
    ordersCount.reload()
    reloadItems()
    reloadForeign()
    reloadCustomers()
  }

  async function save(payload: SaleInput, pending: boolean) {
    if (form?.order) await ordersApi.update({ id: form.order, ...payload })
    else if (form?.sale) await salesApi.update({ id: form.sale.id, ...payload })
    else if (pending) await ordersApi.create(payload)
    else await salesApi.create(payload)
    toast.success(t(form?.sale ? 'toast.updated' : pending ? 'orders.created' : 'toast.created'))
    if (pending && !form?.sale) setTab('orders')
    setForm(null)
    refresh()
  }

  async function confirmOrder(values: { sale_date: string; paid: string }) {
    if (!confirming) return
    const saleId = await ordersApi.confirm({ id: confirming.id, ...values })
    toast.success(t('orders.confirmed', { id: saleId }))
    setConfirming(null)
    refresh()
  }

  /** رجوع فاتورة بيع لتحت التجهيز: القطع بترجع المخزون واللي اتدفع بيبقى عربون */
  async function toPending(row: Sale) {
    const orderId = await ordersApi.fromSale({ id: row.id })
    toast.success(t('orders.movedToPending', { id: orderId }))
    setToPendingRow(null)
    setTab('orders')
    refresh()
  }

  async function createCustomer(name: string): Promise<number> {
    const id = await customersApi.create({ name })
    toast.success(t('toast.customerCreated', { name }))
    reloadCustomers()
    return id
  }

  const { ask, dialog } = useConfirmDelete<Sale>(
    async (row) => {
      await salesApi.remove({ id: row.id })
      toast.success(t('toast.deleted'))
      refresh()
    },
    {
      getName: (row) => `#${row.id}${row.customer_name ? ` — ${row.customer_name}` : ''}`,
      note: t('sales.deleteNote'),
      getWarning: (row) => (grossPaid(row) > 0 ? t('sales.deletePaymentsWarning', { amount: formatMoney(grossPaid(row), i18n.language) }) : null)
    }
  )

  const cancelOrder = useConfirmDelete<SaleOrder>(
    async (row) => {
      await ordersApi.remove({ id: row.id })
      toast.success(t('orders.cancelled'))
      refresh()
    },
    {
      getName: (row) => `#${row.id}${row.customer_name ? ` — ${row.customer_name}` : ''} — ${formatMoney(row.total, i18n.language)}`,
      note: t('orders.cancelNote'),
      getWarning: (row) => (row.deposit > 0 ? t('orders.cancelDepositWarning', { amount: formatMoney(row.deposit, i18n.language) }) : null)
    }
  )

  const count = ordersCount.data ?? 0

  return (
    <>
      <PageHeader title={t('sales.title')}>
        <SearchBar value={search} onChange={setSearch} />
        {tab === 'sales' && <ExportMenu target={{ dataset: 'sales', search, partnerId, ...range }} />}
        <Button variant="primary" icon={Plus} onClick={() => setForm({ sale: null })}>{t('sales.add')}</Button>
      </PageHeader>

      <div className="mb-3.5">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'sales', label: t('orders.tabSales') },
            { value: 'orders', label: count > 0 ? t('orders.tabOrdersCount', { count }) : t('orders.tabOrders') }
          ]}
        />
      </div>

      <div className="mb-4">
        <DateRangeFilter range={range} onChange={setRange}>
          {tab === 'sales' && partners.length > 0 && (
            <FilterGroup label={t('sales.soldBy')}>
              <Segmented
                value={partnerFilter}
                onChange={setPartnerFilter}
                options={[{ value: '', label: t('sales.allPartners') }, ...partners.map((p) => ({ value: String(p.id), label: p.name }))]}
              />
            </FilterGroup>
          )}
        </DateRangeFilter>
      </div>

      {tab === 'sales' ? (
        <>
          <InvoicesTable
            kind="sale"
            rows={pagination.pageRows}
            showPartner={partners.length > 0}
            onView={async (row) => {
              const full = await salesApi.get({ id: row.id })
              if (full) setInvoice(fromSale(full))
            }}
            onEdit={async (row) => setForm({ sale: await salesApi.get({ id: row.id }) })}
            onToPending={setToPendingRow}
            onDelete={ask}
          />
          <Pagination {...pagination} />
        </>
      ) : (
        <>
          <p className="mb-3 text-sm text-slate-500">{t('orders.note')}</p>
          <OrdersTable
            rows={orders.pageRows}
            showPartner={partners.length > 0}
            onConfirm={setConfirming}
            onEdit={async (row) => setForm({ sale: orderToSale(await ordersApi.get({ id: row.id })), order: row.id })}
            onCancel={cancelOrder.ask}
          />
          <Pagination {...orders} />
        </>
      )}

      {form && (
        <Modal title={form.order ? t('orders.edit', { id: form.order }) : t(form.sale ? 'sales.edit' : 'sales.add')} onClose={() => setForm(null)} wide>
          <SaleForm
            items={items}
            foreign={foreign}
            storeLabel={label(active)}
            customers={customers}
            partners={partners}
            onCreateCustomer={createCustomer}
            initial={form.sale}
            orderMode={form.order ? 'order' : form.sale ? undefined : 'choose'}
            onSubmit={save}
            onCancel={() => setForm(null)}
          />
        </Modal>
      )}
      {toPendingRow && (
        <ConfirmActionDialog
          title={t('orders.toPendingTitle')}
          question={t('orders.toPendingQuestion')}
          detail={`#${toPendingRow.id}${toPendingRow.customer_name ? ` — ${toPendingRow.customer_name}` : ''} — ${formatMoney(toPendingRow.total, i18n.language)}`}
          effects={[
            t('orders.toPendingStock'),
            t('orders.toPendingAccounts'),
            grossPaid(toPendingRow) > 0 ? t('orders.toPendingDeposit', { amount: formatMoney(Math.min(toPendingRow.total, toPendingRow.paid), i18n.language) }) : t('orders.toPendingNoDeposit'),
            t('orders.toPendingNumber')
          ]}
          confirmLabel={t('orders.toPendingAction')}
          icon={PackageOpen}
          onConfirm={() => toPending(toPendingRow)}
          onCancel={() => setToPendingRow(null)}
        />
      )}
      {confirming && <ConfirmOrderDialog order={confirming} onConfirm={confirmOrder} onClose={() => setConfirming(null)} />}
      {invoice && <InvoiceViewer data={invoice} onClose={() => setInvoice(null)} />}
      {dialog}
      {cancelOrder.dialog}
    </>
  )
}
