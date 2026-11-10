import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import type { CustomerSummary } from '@shared/types'
import { ExportMenu } from '@/shared/components/data/ExportMenu'
import { Pagination } from '@/shared/components/data/Pagination'
import { SearchBar } from '@/shared/components/data/SearchBar'
import { Button, Modal, PageHeader, Segmented } from '@/shared/components/ui'
import { useConfirmDelete } from '@/shared/hooks/useConfirmDelete'
import { useToast } from '@/shared/toast/ToastProvider'
import { formatMoney } from '@/shared/utils/format'
import { DateRangeFilter, FilterGroup } from '@/shared/components/data/DateRangeFilter'
import type { DateRange } from '@/shared/components/data/DateRangeFilter'
import { customersApi } from '../api/customers.api'
import { CollectDialog } from '../components/CollectDialog'
import type { CollectValues } from '../components/CollectDialog'
import { CustomerForm } from '../components/CustomerForm'
import { CustomersTable } from '../components/CustomersTable'
import { useCustomersPage } from '../hooks/useCustomers'

type Filter = 'all' | 'owing'

export default function CustomersPage() {
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [editing, setEditing] = useState<{ row: CustomerSummary | null } | null>(null)
  const [collecting, setCollecting] = useState<CustomerSummary | null>(null)
  const [range, setRange] = useState<DateRange>({ from: '', to: '' })
  const pagination = useCustomersPage(search, filter === 'owing', range)
  const { reload } = pagination

  async function save(values: { name: string; phone: string }) {
    if (editing?.row) await customersApi.update({ id: editing.row.id, ...values })
    else await customersApi.create(values)
    toast.success(t(editing?.row ? 'toast.updated' : 'toast.created'))
    setEditing(null)
    reload()
  }

  async function collect(values: CollectValues) {
    if (!collecting) return
    await customersApi.collect({ customer_id: collecting.id, ...values })
    toast.success(t('toast.collected', { amount: formatMoney(Number(values.amount), i18n.language) }))
    setCollecting(null)
    reload()
  }

  const { ask, dialog } = useConfirmDelete<CustomerSummary>(
    async (row) => {
      await customersApi.remove({ id: row.id })
      toast.success(t('toast.deleted'))
      reload()
    },
    { getName: (row) => row.name }
  )

  return (
    <>
      <PageHeader title={t('customers.title')}>
        <SearchBar value={search} onChange={setSearch} />
        <ExportMenu target={{ dataset: 'customers', search, ...range }} />
        <Button variant="primary" icon={Plus} onClick={() => setEditing({ row: null })}>{t('customers.add')}</Button>
      </PageHeader>

      <div className="mb-4">
        <DateRangeFilter range={range} onChange={setRange}>
          <FilterGroup label={t('payment.status')}>
            <Segmented
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'owing', label: t('customers.filterOwing') },
                { value: 'all', label: t('customers.filterAll') }
              ]}
            />
          </FilterGroup>
        </DateRangeFilter>
        {(range.from || range.to) && <p className="mt-2 text-sm text-slate-500">{t('customers.rangeNote')}</p>}
      </div>

      <CustomersTable
        rows={pagination.pageRows}
        onDetails={(row) => navigate(`/customers/${row.id}`)}
        onCollect={setCollecting}
        onEdit={(row) => setEditing({ row })}
        onDelete={ask}
      />
      <Pagination {...pagination} />

      {editing && (
        <Modal title={t(editing.row ? 'customers.edit' : 'customers.add')} onClose={() => setEditing(null)}>
          <CustomerForm initial={editing.row} onSubmit={save} onCancel={() => setEditing(null)} />
        </Modal>
      )}
      {collecting && <CollectDialog subject={collecting.name} remaining={collecting.remaining} perCustomer onSubmit={collect} onClose={() => setCollecting(null)} />}
      {dialog}
    </>
  )
}
