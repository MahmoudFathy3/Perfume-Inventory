import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Purchase, PurchaseInput, PurchaseWithLines } from '@shared/types'
import { ExportMenu } from '@/shared/components/data/ExportMenu'
import { Pagination } from '@/shared/components/data/Pagination'
import { SearchBar } from '@/shared/components/data/SearchBar'
import { fromPurchase } from '@/shared/components/invoice/invoice.types'
import type { InvoiceDocData } from '@/shared/components/invoice/invoice.types'
import { InvoicesTable } from '@/shared/components/invoice/InvoicesTable'
import { InvoiceViewer } from '@/shared/components/invoice/InvoiceViewer'
import { PurchaseForm } from '@/shared/components/invoice/PurchaseForm'
import { Button, Modal, PageHeader } from '@/shared/components/ui'
import { useConfirmDelete } from '@/shared/hooks/useConfirmDelete'
import { useToast } from '@/shared/toast/ToastProvider'
import { useCategories } from '../../categories'
import { useItems } from '../../items'
import { purchasesApi } from '../api/purchases.api'
import { usePurchases } from '../hooks/usePurchases'

export default function PurchasesPage() {
  const { t } = useTranslation()
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [form, setForm] = useState<{ purchase: PurchaseWithLines | null } | null>(null) // purchase = null: فاتورة جديدة
  const [invoice, setInvoice] = useState<InvoiceDocData | null>(null)
  const pagination = usePurchases(search)
  const { reload } = pagination
  const { items, reload: reloadItems } = useItems('')
  const { categories, reload: reloadCategories } = useCategories('')

  /** أي تغيير في فاتورة شراء بيأثر على المخزن والمنتجات */
  const refresh = () => {
    reload()
    reloadItems()
    reloadCategories()
  }

  async function save(payload: PurchaseInput) {
    if (form?.purchase) await purchasesApi.update({ id: form.purchase.id, ...payload })
    else await purchasesApi.create(payload)
    toast.success(t(form?.purchase ? 'toast.updated' : 'toast.created'))
    setForm(null)
    refresh()
  }

  async function open(row: Purchase): Promise<PurchaseWithLines | null> {
    return purchasesApi.get({ id: row.id })
  }

  const { ask, dialog } = useConfirmDelete<Purchase>(
    async (row) => {
      await purchasesApi.remove({ id: row.id })
      toast.success(t('toast.deleted'))
      refresh()
    },
    { getName: (row) => `#${row.id} — ${row.supplier_name}`, note: t('purchases.deleteNote') }
  )

  return (
    <>
      <PageHeader title={t('purchases.title')}>
        <SearchBar value={search} onChange={setSearch} />
        <ExportMenu target={{ dataset: 'purchases', search }} />
        <Button variant="primary" icon={Plus} onClick={() => setForm({ purchase: null })}>{t('purchases.add')}</Button>
      </PageHeader>

      <InvoicesTable
        kind="purchase"
        rows={pagination.pageRows}
        onView={async (row) => {
          const full = await open(row)
          if (full) setInvoice(fromPurchase(full))
        }}
        onEdit={async (row) => setForm({ purchase: await open(row) })}
        onDelete={ask}
      />
      <Pagination {...pagination} />

      {form && (
        <Modal title={t(form.purchase ? 'purchases.edit' : 'purchases.add')} onClose={() => setForm(null)} wide>
          <PurchaseForm items={items} categories={categories} initial={form.purchase} onSubmit={save} onCancel={() => setForm(null)} />
        </Modal>
      )}
      {invoice && <InvoiceViewer data={invoice} onClose={() => setInvoice(null)} />}
      {dialog}
    </>
  )
}
