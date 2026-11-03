import { Plus, Warehouse } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Workspace, WorkspaceInput } from '@shared/types'
import { Button, Modal, PageHeader } from '@/shared/components/ui'
import { useToast } from '@/shared/toast/ToastProvider'
import { workspacesApi } from '../api/workspaces.api'
import { PasswordConfirmModal } from '../components/PasswordConfirmModal'
import { WorkspaceForm } from '../components/WorkspaceForm'
import { WorkspacesTable } from '../components/WorkspacesTable'
import { useWorkspaces } from '../WorkspaceProvider'

/** العمليات اللي بتطلب كلمة سر التطبيق: العنوان، زرار التأكيد، ورسالة النجاح */
const GUARDED = {
  close: { title: 'workspaces.closeTitle', confirm: 'workspaces.close', done: 'workspaces.closedDone' },
  reopen: { title: 'workspaces.reopenTitle', confirm: 'workspaces.reopen', done: 'workspaces.reopened' },
  remove: { title: 'workspaces.removeTitle', confirm: 'common.delete', done: 'toast.deleted' }
} as const

type GuardedAction = keyof typeof GUARDED

/** إدارة المخازن: المخزون الفعلي (ثابت) والشراكات والمخازن الخارجية (إضافة، تعديل، قفل، حذف الفاضية) */
export default function WorkspacesPage() {
  const { t } = useTranslation()
  const toast = useToast()
  const { workspaces, activate, reload, label } = useWorkspaces()
  const [editing, setEditing] = useState<{ row: Workspace | null; kind: 'partnership' | 'warehouse' } | null>(null)
  const editingWarehouse = (editing?.row?.kind ?? editing?.kind) === 'warehouse'
  const [pending, setPending] = useState<{ row: Workspace; action: GuardedAction } | null>(null)

  async function save(values: WorkspaceInput) {
    if (editing?.row) await workspacesApi.update({ id: editing.row.id, ...values })
    else await workspacesApi.create({ ...values, kind: editing?.kind })
    toast.success(t(editing?.row ? 'toast.updated' : 'toast.created'))
    setEditing(null)
    await reload()
  }

  /** قفل أو فتح أو حذف الشراكة بعد تأكيد كلمة السر */
  async function confirm(password: string) {
    if (!pending) return
    const { row, action } = pending
    await workspacesApi[action]({ id: row.id, password })
    toast.success(t(GUARDED[action].done))
    setPending(null)
    await reload()
  }

  return (
    <>
      <PageHeader title={t('workspaces.title')}>
        <Button icon={Warehouse} onClick={() => setEditing({ row: null, kind: 'warehouse' })}>{t('workspaces.addWarehouse')}</Button>
        <Button variant="primary" icon={Plus} onClick={() => setEditing({ row: null, kind: 'partnership' })}>{t('workspaces.add')}</Button>
      </PageHeader>

      <WorkspacesTable
        rows={workspaces}
        onSwitch={(row) => activate(row.id).catch(toast.fail)}
        onEdit={(row) => setEditing({ row, kind: row.kind === 'warehouse' ? 'warehouse' : 'partnership' })}
        onClose={(row) => setPending({ row, action: 'close' })}
        onReopen={(row) => setPending({ row, action: 'reopen' })}
        onDelete={(row) => setPending({ row, action: 'remove' })}
      />
      <p className="mt-3 text-sm text-slate-500">{t('workspaces.closeNote')}</p>

      {editing && (
        <Modal
          title={t(editingWarehouse ? (editing.row ? 'workspaces.editWarehouse' : 'workspaces.addWarehouse') : editing.row ? 'workspaces.edit' : 'workspaces.add')}
          onClose={() => setEditing(null)}
        >
          <WorkspaceForm initial={editing.row} kind={editing.kind} onSubmit={save} onCancel={() => setEditing(null)} />
        </Modal>
      )}
      {pending && (
        <PasswordConfirmModal
          title={t(GUARDED[pending.action].title)}
          detail={label(pending.row)}
          note={pending.action === 'remove' ? t('workspaces.deleteNote') : undefined}
          confirmLabel={t(GUARDED[pending.action].confirm)}
          danger={pending.action === 'remove'}
          onConfirm={confirm}
          onCancel={() => setPending(null)}
        />
      )}
    </>
  )
}
