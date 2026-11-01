import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Sale, SaleInput, SaleWithLines } from '@shared/types'
import { ExportMenu } from '@/shared/components/data/ExportMenu'
import { Pagination } from '@/shared/components/data/Pagination'
import { SearchBar } from '@/shared/components/data/SearchBar'
import { fromSale } from '@/shared/components/invoice/invoice.types'
import type { InvoiceDocData } from '@/shared/components/invoice/invoice.types'
import { InvoicesTable } from '@/shared/components/invoice/InvoicesTable'
import { InvoiceViewer } from '@/shared/components/invoice/InvoiceViewer'
import { SaleForm } from '@/shared/components/invoice/SaleForm'
import { Button, Modal, PageHeader } from '@/shared/components/ui'
import { useConfirmDelete } from '@/shared/hooks/useConfirmDelete'
import { useToast } from '@/shared/toast/ToastProvider'
import { formatMoney } from '@/shared/utils/format'
import { customersApi, useCustomers } from '../../customers'
import { useItems } from '../../items'
import { salesApi } from '../api/sales.api'
import { useSales } from '../hooks/useSales'

export default function SalesPage() {
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [form, setForm] = useState<{ sale: SaleWithLines | null } | null>(null) // sale = null: فاتورة جديدة
  const [invoice, setInvoice] = useState<InvoiceDocData | null>(null)
  const pagination = useSales(search)
  const { reload } = pagination
  const { items, reload: reloadItems } = useItems('')
  const { customers, reload: reloadCustomers } = useCustomers()

  /** أي تغيير في فاتورة بيع بيأثر على المخزن والعملاء */
  const refresh = () => {
    reload()
    reloadItems()
    reloadCustomers()
  }

  async function save(payload: SaleInput) {
    if (form?.sale) await salesApi.update({ id: form.sale.id, ...payload })
    else await salesApi.create(payload)
    toast.success(t(form?.sale ? 'toast.updated' : 'toast.created'))
    setForm(null)
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
      getWarning: (row) => (row.paid > 0 ? t('sales.deletePaymentsWarning', { amount: formatMoney(row.paid, i18n.language) }) : null)
    }
  )

  return (
    <>
      <PageHeader title={t('sales.title')}>
        <SearchBar value={search} onChange={setSearch} />
        <ExportMenu target={{ dataset: 'sales', search }} />
        <Button variant="primary" icon={Plus} onClick={() => setForm({ sale: null })}>{t('sales.add')}</Button>
      </PageHeader>

      <InvoicesTable
        kind="sale"
        rows={pagination.pageRows}
        onView={async (row) => {
          const full = await salesApi.get({ id: row.id })
          if (full) setInvoice(fromSale(full))
        }}
        onEdit={async (row) => setForm({ sale: await salesApi.get({ id: row.id }) })}
        onDelete={ask}
      />
      <Pagination {...pagination} />

      {form && (
        <Modal title={t(form.sale ? 'sales.edit' : 'sales.add')} onClose={() => setForm(null)} wide>
          <SaleForm items={items} customers={customers} onCreateCustomer={createCustomer} initial={form.sale} onSubmit={save} onCancel={() => setForm(null)} />
        </Modal>
      )}
      {invoice && <InvoiceViewer data={invoice} onClose={() => setInvoice(null)} />}
      {dialog}
    </>
  )
}
