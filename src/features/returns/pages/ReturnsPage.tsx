import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ReturnInput, ReturnRecord } from '@shared/types'
import { ExportMenu } from '@/shared/components/data/ExportMenu'
import { Pagination } from '@/shared/components/data/Pagination'
import { SearchBar } from '@/shared/components/data/SearchBar'
import { fromReturn } from '@/shared/components/invoice/invoice.types'
import type { InvoiceDocData } from '@/shared/components/invoice/invoice.types'
import { InvoiceViewer } from '@/shared/components/invoice/InvoiceViewer'
import { Button, Modal, PageHeader } from '@/shared/components/ui'
import { useConfirmDelete } from '@/shared/hooks/useConfirmDelete'
import { useQuery } from '@/shared/hooks/useQuery'
import { useToast } from '@/shared/toast/ToastProvider'
import { purchasesApi } from '../../purchases'
import { salesApi } from '../../sales'
import { returnsApi } from '../api/returns.api'
import { ReturnForm } from '../components/ReturnForm'
import { ReturnsTable } from '../components/ReturnsTable'
import { useReturns } from '../hooks/useReturns'

export default function ReturnsPage() {
  const { t } = useTranslation()
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [invoice, setInvoice] = useState<InvoiceDocData | null>(null)
  const pagination = useReturns(search)
  const { reload } = pagination
  const sales = useQuery(() => salesApi.list({}), [])
  const purchases = useQuery(() => purchasesApi.list({}), [])

  async function save(payload: ReturnInput) {
    await returnsApi.create(payload)
    toast.success(t('toast.created'))
    setCreating(false)
    reload()
  }

  // حذف مرتجع بيعكس تأثيره على المخزن (ويترفض لو القطع اتباعت)
  const { ask, dialog } = useConfirmDelete<ReturnRecord>(
    async (row) => {
      await returnsApi.remove({ id: row.id })
      toast.success(t('toast.deleted'))
      reload()
    },
    { getName: (row) => `#${row.id} — ${row.type === 'sale' ? row.customer_name : row.supplier_name}`, note: t('returns.deleteNote') }
  )

  async function view(row: ReturnRecord) {
    const record = await returnsApi.get({ id: row.id })
    if (record) setInvoice(fromReturn(record))
  }

  return (
    <>
      <PageHeader title={t('returns.title')}>
        <SearchBar value={search} onChange={setSearch} />
        <ExportMenu target={{ dataset: 'returns', search }} />
        <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>{t('returns.add')}</Button>
      </PageHeader>

      <ReturnsTable rows={pagination.pageRows} onView={view} onDelete={ask} />
      <Pagination {...pagination} />

      {creating && (
        <Modal title={t('returns.add')} onClose={() => setCreating(false)} wide>
          <ReturnForm sales={sales.data ?? []} purchases={purchases.data ?? []} onSubmit={save} onCancel={() => setCreating(false)} />
        </Modal>
      )}
      {invoice && <InvoiceViewer data={invoice} onClose={() => setInvoice(null)} />}
      {dialog}
    </>
  )
}
