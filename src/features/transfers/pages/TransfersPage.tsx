import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Transfer, TransferDetails, TransferInput } from '@shared/types'
import { Pagination } from '@/shared/components/data/Pagination'
import { Button, Modal, PageHeader } from '@/shared/components/ui'
import { useConfirmDelete } from '@/shared/hooks/useConfirmDelete'
import { useToast } from '@/shared/toast/ToastProvider'
import { useWorkspaces } from '../../workspaces'
import { transfersApi } from '../api/transfers.api'
import { TransferDetailsModal } from '../components/TransferDetailsModal'
import { TransferForm } from '../components/TransferForm'
import { TransfersTable } from '../components/TransfersTable'
import { useTransfers } from '../hooks/useTransfers'

/** التحويل بين المخزون الفعلي والشراكات (رأس مال / بيع / بالنص) */
export default function TransfersPage() {
  const { t } = useTranslation()
  const toast = useToast()
  const { workspaces, active, label } = useWorkspaces()
  const [creating, setCreating] = useState(false)
  const [viewing, setViewing] = useState<TransferDetails | null>(null)
  const pagination = useTransfers()
  const { reload } = pagination

  const nameOf = (id: number) => {
    const ws = workspaces.find((w) => w.id === id)
    return ws ? label(ws) : `#${id}`
  }

  async function save(payload: TransferInput) {
    await transfersApi.create(payload)
    toast.success(t('toast.created'))
    setCreating(false)
    reload()
  }

  // حذف التحويل بيرجّع القطع للمخزن اللي خرجت منه (ويترفض لو الوجهة باعتها)
  const { ask, dialog } = useConfirmDelete<Transfer>(
    async (row) => {
      await transfersApi.remove({ id: row.id })
      toast.success(t('toast.deleted'))
      reload()
    },
    { getName: (row) => `#${row.id} — ${nameOf(row.from_workspace_id)} ← ${nameOf(row.to_workspace_id)}`, note: t('transfers.deleteNote') }
  )

  return (
    <>
      <PageHeader title={t('transfers.title')}>
        <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>{t('transfers.add')}</Button>
      </PageHeader>

      <TransfersTable rows={pagination.pageRows} nameOf={nameOf} onView={async (row) => setViewing(await transfersApi.get({ id: row.id }))} onDelete={ask} />
      <Pagination {...pagination} />

      {creating && (
        <Modal title={t('transfers.add')} onClose={() => setCreating(false)} wide>
          <TransferForm active={active} workspaces={workspaces} nameOf={nameOf} onSubmit={save} onCancel={() => setCreating(false)} />
        </Modal>
      )}
      {viewing && <TransferDetailsModal transfer={viewing} nameOf={nameOf} onClose={() => setViewing(null)} />}
      {dialog}
    </>
  )
}
