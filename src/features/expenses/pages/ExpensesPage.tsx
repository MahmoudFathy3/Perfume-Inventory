import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Expense, ExpenseInput } from '@shared/types'
import { DateRangeFilter, FilterGroup } from '@/shared/components/data/DateRangeFilter'
import type { DateRange } from '@/shared/components/data/DateRangeFilter'
import { ExportMenu } from '@/shared/components/data/ExportMenu'
import { Pagination } from '@/shared/components/data/Pagination'
import { SearchBar } from '@/shared/components/data/SearchBar'
import { Button, Modal, PageHeader, StatCard } from '@/shared/components/ui'
import { useConfirmDelete } from '@/shared/hooks/useConfirmDelete'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { usePagedQuery } from '@/shared/hooks/usePagedQuery'
import { useQuery } from '@/shared/hooks/useQuery'
import { useToast } from '@/shared/toast/ToastProvider'
import { formatDate, formatMoney } from '@/shared/utils/format'
import { expensesApi } from '../api/expenses.api'
import { ExpenseForm } from '../components/ExpenseForm'
import { ExpenseTypeSelect } from '../components/ExpenseTypeSelect'
import { ExpensesTable } from '../components/ExpensesTable'

/** المصروفات (إيجار، رواتب...) للمخزن النشط: تسجيل وتعديل وحذف + فلتر بالنوع والفترة وإجمالياتهم */
export default function ExpensesPage() {
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const [search, setSearch] = useState('')
  const q = useDebounce(search)
  const [category, setCategory] = useState('')
  const [range, setRange] = useState<DateRange>({ from: '', to: '' })
  const [editing, setEditing] = useState<{ row: Expense | null } | null>(null)

  const filter = { search: q, category, ...range }
  const deps = [q, category, range.from, range.to]
  const pagination = usePagedQuery((page) => expensesApi.page({ ...filter, ...page }), deps)
  const totalsQuery = useQuery(() => expensesApi.totals(filter), deps)
  const categories = useQuery(() => expensesApi.categories(), [])
  const totals = totalsQuery.data
  const money = (v: number) => formatMoney(v, i18n.language)

  const refresh = () => {
    pagination.reload()
    totalsQuery.reload()
    categories.reload()
  }

  async function save(values: ExpenseInput) {
    if (editing?.row) await expensesApi.update({ id: editing.row.id, ...values })
    else await expensesApi.create(values)
    toast.success(t(editing?.row ? 'toast.updated' : 'toast.created'))
    setEditing(null)
    refresh()
  }

  const { ask, dialog } = useConfirmDelete<Expense>(
    async (row) => {
      await expensesApi.remove({ id: row.id })
      toast.success(t('toast.deleted'))
      refresh()
    },
    { getName: (row) => `${row.category} — ${money(row.amount)} (${formatDate(row.expense_date)})` }
  )

  return (
    <>
      <PageHeader title={t('expenses.title')}>
        <SearchBar value={search} onChange={setSearch} />
        <ExportMenu target={{ dataset: 'expenses', search: q, category, ...range }} />
        <Button variant="primary" icon={Plus} onClick={() => setEditing({ row: null })}>{t('expenses.add')}</Button>
      </PageHeader>

      <div className="mb-4">
        <DateRangeFilter range={range} onChange={setRange}>
          <FilterGroup label={t('expenses.category')}>
            <div className="w-56">
              <ExpenseTypeSelect types={categories.data ?? []} value={category} onChange={setCategory} placeholder={t('expenses.allCategories')} />
            </div>
          </FilterGroup>
        </DateRangeFilter>
      </div>

      {totals && (
        <div className="mb-4 grid grid-cols-3 gap-4">
          <StatCard label={t('expenses.total')} value={money(totals.total)} sub={t('expenses.count', { count: totals.count })} tone="slate" big />
          <StatCard label={t('expenses.deductedTotal')} value={money(totals.deducted)} sub={t('expenses.deductedSub')} tone="indigo" />
          <StatCard label={t('expenses.recordOnlyTotal')} value={money(totals.total - totals.deducted)} sub={t('expenses.recordOnlySub')} />
        </div>
      )}

      <ExpensesTable rows={pagination.pageRows} onEdit={(row) => setEditing({ row })} onDelete={ask} />
      <Pagination {...pagination} />

      {editing && (
        <Modal title={t(editing.row ? 'expenses.edit' : 'expenses.add')} onClose={() => setEditing(null)}>
          <ExpenseForm initial={editing.row} categories={categories.data ?? []} onSubmit={save} onCancel={() => setEditing(null)} />
        </Modal>
      )}
      {dialog}
    </>
  )
}
