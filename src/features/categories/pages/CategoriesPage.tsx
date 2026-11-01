import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Category } from '@shared/types'
import { ExportMenu } from '@/shared/components/data/ExportMenu'
import { Pagination } from '@/shared/components/data/Pagination'
import { SearchBar } from '@/shared/components/data/SearchBar'
import { Button, Modal, PageHeader } from '@/shared/components/ui'
import { useConfirmDelete } from '@/shared/hooks/useConfirmDelete'
import { useToast } from '@/shared/toast/ToastProvider'
import { categoriesApi } from '../api/categories.api'
import { CategoriesTable } from '../components/CategoriesTable'
import { CategoryForm } from '../components/CategoryForm'
import { useCategoriesPage } from '../hooks/useCategories'

export default function CategoriesPage() {
  const { t } = useTranslation()
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<{ row: Category | null } | null>(null)
  const pagination = useCategoriesPage(search)
  const { reload } = pagination

  async function save(values: { name: string }) {
    if (editing?.row) await categoriesApi.update({ id: editing.row.id, ...values })
    else await categoriesApi.create(values)
    toast.success(t(editing?.row ? 'toast.updated' : 'toast.created'))
    setEditing(null)
    reload()
  }

  const { ask, dialog } = useConfirmDelete<Category>(
    async (row) => {
      await categoriesApi.remove({ id: row.id })
      toast.success(t('toast.deleted'))
      reload()
    },
    { getName: (row) => row.name }
  )

  return (
    <>
      <PageHeader title={t('categories.title')}>
        <SearchBar value={search} onChange={setSearch} />
        <ExportMenu target={{ dataset: 'categories', search }} />
        <Button variant="primary" icon={Plus} onClick={() => setEditing({ row: null })}>{t('categories.addCategory')}</Button>
      </PageHeader>

      <CategoriesTable rows={pagination.pageRows} onEdit={(row) => setEditing({ row })} onDelete={ask} />
      <Pagination {...pagination} />

      {editing && (
        <Modal title={t(editing.row ? 'categories.editCategory' : 'categories.addCategory')} onClose={() => setEditing(null)}>
          <CategoryForm initial={editing.row} onSubmit={save} onCancel={() => setEditing(null)} />
        </Modal>
      )}
      {dialog}
    </>
  )
}
