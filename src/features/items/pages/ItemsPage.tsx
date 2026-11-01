import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import type { Item } from '@shared/types'
import { ExportMenu } from '@/shared/components/data/ExportMenu'
import { Pagination } from '@/shared/components/data/Pagination'
import { SearchBar } from '@/shared/components/data/SearchBar'
import { Button, Modal, PageHeader } from '@/shared/components/ui'
import { useConfirmDelete } from '@/shared/hooks/useConfirmDelete'
import { useToast } from '@/shared/toast/ToastProvider'
import { useCategories } from '../../categories'
import { itemsApi } from '../api/items.api'
import { CopyPriceListButton } from '../components/CopyPriceListButton'
import { StockCountButton } from '../components/StockCountButton'
import { ItemForm } from '../components/ItemForm'
import { ItemsTable } from '../components/ItemsTable'
import { useItemsPage } from '../hooks/useItems'

export default function ItemsPage() {
  const { t } = useTranslation()
  const toast = useToast()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<{ item: Item | null } | null>(null)
  const pagination = useItemsPage(search)
  const { reload } = pagination
  const { categories } = useCategories('')

  async function save(values: Parameters<typeof itemsApi.create>[0]) {
    if (editing?.item) await itemsApi.update({ id: editing.item.id, ...values })
    else await itemsApi.create(values)
    toast.success(t(editing?.item ? 'toast.updated' : 'toast.created'))
    setEditing(null)
    reload()
  }

  // لو المنتج مرتبط بفواتير بيتأرشف (بيتخفي) بدل ما يتحذف
  const { ask, dialog } = useConfirmDelete<Item>(
    async (item) => {
      const { mode } = await itemsApi.remove({ id: item.id })
      toast.success(t(mode === 'archived' ? 'toast.archived' : 'toast.deleted'))
      reload()
    },
    {
      getName: (item) => `${item.name_ar}${item.name_en ? ` — ${item.name_en}` : ''}`,
      note: t('items.archiveNote'),
      getWarning: (item) => {
        const count = item.new_quantity + item.damaged_quantity
        return count > 0 ? t('items.stockWarning', { count }) : null
      }
    }
  )

  return (
    <>
      <PageHeader title={t('items.title')}>
        <SearchBar value={search} onChange={setSearch} />
        <StockCountButton />
        <CopyPriceListButton />
        <ExportMenu target={{ dataset: 'items', search }} />
        <Button variant="primary" icon={Plus} onClick={() => setEditing({ item: null })}>{t('items.add')}</Button>
      </PageHeader>

      <ItemsTable items={pagination.pageRows} onEdit={(item) => setEditing({ item })} onDelete={ask} onDetails={(item) => navigate(`/items/${item.id}`)} />
      <Pagination {...pagination} />

      {editing && (
        <Modal title={t(editing.item ? 'items.edit' : 'items.add')} onClose={() => setEditing(null)} wide>
          <ItemForm initial={editing.item} categories={categories} onSubmit={save} onCancel={() => setEditing(null)} />
        </Modal>
      )}
      {dialog}
    </>
  )
}
