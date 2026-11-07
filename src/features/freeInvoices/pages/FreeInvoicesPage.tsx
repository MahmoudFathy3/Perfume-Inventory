import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { FreeInvoice, FreeInvoiceInput, FreeInvoiceWithLines } from '@shared/types'
import { DateRangeFilter } from '@/shared/components/data/DateRangeFilter'
import type { DateRange } from '@/shared/components/data/DateRangeFilter'
import { Pagination } from '@/shared/components/data/Pagination'
import { SearchBar } from '@/shared/components/data/SearchBar'
import { fromFreeInvoice } from '@/shared/components/invoice/invoice.types'
import type { InvoiceDocData } from '@/shared/components/invoice/invoice.types'
import { InvoiceViewer } from '@/shared/components/invoice/InvoiceViewer'
import { Button, EmptyState, Modal, PageHeader } from '@/shared/components/ui'
import { useConfirmDelete } from '@/shared/hooks/useConfirmDelete'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { usePagedQuery } from '@/shared/hooks/usePagedQuery'
import { useToast } from '@/shared/toast/ToastProvider'
import { formatMoney } from '@/shared/utils/format'
import { customersApi, useCustomers } from '../../customers'
import { useItems } from '../../items'
import { useWorkspaces } from '../../workspaces'
import { freeInvoicesApi } from '../api/freeInvoices.api'
import { FreeInvoiceForm } from '../components/FreeInvoiceForm'
import { FreeInvoicePaymentsModal } from '../components/FreeInvoicePaymentsModal'
import { FreeInvoicesTable } from '../components/FreeInvoicesTable'
import { ToSaleDialog } from '../components/ToSaleDialog'

/** الفواتير الحرّة: في المخزون الفعلي بس */
export default function FreeInvoicesPage() {
  const { t } = useTranslation()
  const { active } = useWorkspaces()
  if (active.kind !== 'personal') {
    return (
      <>
        <PageHeader title={t('freeInvoices.title')} />
        <EmptyState>{t('freeInvoices.personalOnly')}</EmptyState>
      </>
    )
  }
  return <FreeInvoices />
}

/**
 * فواتير للعميل فيها أي بنود (من المخزون أو من برّه) علشان يشوف التوتال، من غير أثر على المخزون أو المبيعات أو الربح.
 * ليها دفعات (اتدفع / الباقي)، وزرار "سجّل بيع" بيعمل فاتورة بيع حقيقية من بنود المخزون بس.
 */
function FreeInvoices() {
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const [search, setSearch] = useState('')
  const q = useDebounce(search)
  const [range, setRange] = useState<DateRange>({ from: '', to: '' })
  const [form, setForm] = useState<{ invoice: FreeInvoiceWithLines | null } | null>(null) // invoice = null: فاتورة جديدة
  const [viewing, setViewing] = useState<InvoiceDocData | null>(null)
  const [paying, setPaying] = useState<number | null>(null)
  const [toSale, setToSale] = useState<number | null>(null)
  const pagination = usePagedQuery((page) => freeInvoicesApi.page({ search: q, ...range, ...page }), [q, range.from, range.to])
  const { items, reload: reloadItems } = useItems('')
  const { customers, reload: reloadCustomers } = useCustomers()
  const money = (v: number) => formatMoney(v, i18n.language)

  async function save(payload: FreeInvoiceInput) {
    if (form?.invoice) await freeInvoicesApi.update({ id: form.invoice.id, ...payload })
    else await freeInvoicesApi.create(payload)
    toast.success(t(form?.invoice ? 'toast.updated' : 'toast.created'))
    setForm(null)
    pagination.reload()
  }

  async function createCustomer(name: string): Promise<number> {
    const id = await customersApi.create({ name })
    toast.success(t('toast.customerCreated', { name }))
    reloadCustomers()
    return id
  }

  const { ask, dialog } = useConfirmDelete<FreeInvoice>(
    async (row) => {
      await freeInvoicesApi.remove({ id: row.id })
      toast.success(t('toast.deleted'))
      pagination.reload()
    },
    {
      getName: (row) => `#${row.id}${row.customer_name ? ` — ${row.customer_name}` : ''} — ${money(row.total)}`,
      note: t('freeInvoices.deleteNote')
    }
  )

  return (
    <>
      <PageHeader title={t('freeInvoices.title')}>
        <SearchBar value={search} onChange={setSearch} />
        <Button variant="primary" icon={Plus} onClick={() => setForm({ invoice: null })}>{t('freeInvoices.add')}</Button>
      </PageHeader>
      <p className="mb-3 text-sm text-slate-500">{t('freeInvoices.note')}</p>
      <div className="mb-4">
        <DateRangeFilter range={range} onChange={setRange} />
      </div>

      <FreeInvoicesTable
        rows={pagination.pageRows}
        onView={async (row) => setViewing(fromFreeInvoice(await freeInvoicesApi.get({ id: row.id })))}
        onEdit={async (row) => setForm({ invoice: await freeInvoicesApi.get({ id: row.id }) })}
        onPayments={(row) => setPaying(row.id)}
        onToSale={(row) => setToSale(row.id)}
        onDelete={ask}
      />
      <Pagination {...pagination} />

      {form && (
        <Modal title={form.invoice ? t('freeInvoices.edit', { id: form.invoice.id }) : t('freeInvoices.add')} onClose={() => setForm(null)} wide>
          <FreeInvoiceForm items={items} customers={customers} onCreateCustomer={createCustomer} initial={form.invoice} onSubmit={save} onCancel={() => setForm(null)} />
        </Modal>
      )}
      {viewing && <InvoiceViewer data={viewing} onClose={() => setViewing(null)} />}
      {paying !== null && <FreeInvoicePaymentsModal invoiceId={paying} onClose={() => setPaying(null)} onChanged={pagination.reload} />}
      {toSale !== null && (
        <ToSaleDialog
          invoiceId={toSale}
          onClose={() => setToSale(null)}
          onDone={(saleId) => {
            toast.success(t('freeInvoices.saleCreated', { id: saleId }))
            setToSale(null)
            pagination.reload()
            reloadItems()
          }}
        />
      )}
      {dialog}
    </>
  )
}
