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
import { grossPaid } from '@/shared/components/invoice/SalePaidCell'
import { SaleForm } from '@/shared/components/invoice/SaleForm'
import { Button, Modal, PageHeader, Segmented } from '@/shared/components/ui'
import { useConfirmDelete } from '@/shared/hooks/useConfirmDelete'
import { useToast } from '@/shared/toast/ToastProvider'
import { formatMoney } from '@/shared/utils/format'
import { customersApi, useCustomers } from '../../customers'
import { useItems } from '../../items'
import { useWorkspaces } from '../../workspaces'
import { salesApi } from '../api/sales.api'
import { useForeignItems } from '../hooks/useForeignItems'
import { useSales } from '../hooks/useSales'

export default function SalesPage() {
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const [search, setSearch] = useState('')
  const { active, label } = useWorkspaces()
  const partners = active.kind === 'partnership' ? active.partners : []
  const [partnerFilter, setPartnerFilter] = useState('') // '' = كل الشركاء
  const [form, setForm] = useState<{ sale: SaleWithLines | null } | null>(null) // sale = null: فاتورة جديدة
  const [invoice, setInvoice] = useState<InvoiceDocData | null>(null)
  const partnerId = partnerFilter ? Number(partnerFilter) : undefined
  const pagination = useSales(search, partnerId)
  const { reload } = pagination
  const { items, reload: reloadItems } = useItems('')
  const { customers, reload: reloadCustomers } = useCustomers()
  const { foreign, reload: reloadForeign } = useForeignItems()

  /** أي تغيير في فاتورة بيع بيأثر على المخزن والعملاء */
  const refresh = () => {
    reload()
    reloadItems()
    reloadForeign()
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
      getWarning: (row) => (grossPaid(row) > 0 ? t('sales.deletePaymentsWarning', { amount: formatMoney(grossPaid(row), i18n.language) }) : null)
    }
  )

  return (
    <>
      <PageHeader title={t('sales.title')}>
        {partners.length > 0 && (
          <Segmented
            value={partnerFilter}
            onChange={setPartnerFilter}
            options={[{ value: '', label: t('sales.allPartners') }, ...partners.map((p) => ({ value: String(p.id), label: p.name }))]}
          />
        )}
        <SearchBar value={search} onChange={setSearch} />
        <ExportMenu target={{ dataset: 'sales', search, partnerId }} />
        <Button variant="primary" icon={Plus} onClick={() => setForm({ sale: null })}>{t('sales.add')}</Button>
      </PageHeader>

      <InvoicesTable
        kind="sale"
        rows={pagination.pageRows}
        showPartner={partners.length > 0}
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
          <SaleForm items={items} foreign={foreign} storeLabel={label(active)} customers={customers} partners={partners} onCreateCustomer={createCustomer} initial={form.sale} onSubmit={save} onCancel={() => setForm(null)} />
        </Modal>
      )}
      {invoice && <InvoiceViewer data={invoice} onClose={() => setInvoice(null)} />}
      {dialog}
    </>
  )
}
