import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Transfer, TransferDetails, TransferInput, TransferKind } from '@shared/types'
import { Pagination } from '@/shared/components/data/Pagination'
import { Button, Modal, PageHeader, Segmented, Select } from '@/shared/components/ui'
import { useConfirmDelete } from '@/shared/hooks/useConfirmDelete'
import { useToast } from '@/shared/toast/ToastProvider'
import { DateRangeFilter } from '../../dashboard'
import type { DateRange } from '../../dashboard'
import { useWorkspaces } from '../../workspaces'
import { transfersApi } from '../api/transfers.api'
import { TransferDetailsModal } from '../components/TransferDetailsModal'
import { TransferForm } from '../components/TransferForm'
import { TransfersTable } from '../components/TransfersTable'
import { useTransfers } from '../hooks/useTransfers'

const KINDS: TransferKind[] = ['capital', 'sale', 'half']

/** التحويل بين المخزون الفعلي والشراكات (رأس مال / بيع / بالنص): إضافة وتعديل وحذف + فلتر بالنوع والشراكة والفترة */
export default function TransfersPage() {
  const { t } = useTranslation()
  const toast = useToast()
  const { workspaces, active, label } = useWorkspaces()
  const [form, setForm] = useState<{ transfer: TransferDetails | null } | null>(null) // transfer = null: تحويل جديد
  const [viewing, setViewing] = useState<TransferDetails | null>(null)
  const [kind, setKind] = useState<TransferKind | ''>('')
  const [peerId, setPeerId] = useState(0) // 0 = كل الشراكات
  const [range, setRange] = useState<DateRange>({ from: '', to: '' })
  const pagination = useTransfers({ kind, peerId: peerId || undefined, from: range.from, to: range.to })
  const partnerships = workspaces.filter((w) => w.kind === 'partnership')
  const { reload } = pagination

  const nameOf = (id: number) => {
    const ws = workspaces.find((w) => w.id === id)
    return ws ? label(ws) : `#${id}`
  }

  async function save(payload: TransferInput) {
    if (form?.transfer) await transfersApi.update({ id: form.transfer.id, ...payload })
    else await transfersApi.create(payload)
    toast.success(t(form?.transfer ? 'toast.updated' : 'toast.created'))
    setForm(null)
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
        <Button variant="primary" icon={Plus} onClick={() => setForm({ transfer: null })}>{t('transfers.add')}</Button>
      </PageHeader>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Segmented value={kind} onChange={setKind} options={[{ value: '', label: t('transfers.allKinds') }, ...KINDS.map((k) => ({ value: k, label: t(`transfers.kinds.${k}`) }))]} />
        {active.kind === 'personal' && partnerships.length > 1 && (
          <Select value={peerId} onChange={(e) => setPeerId(Number(e.target.value))} className="!w-auto">
            <option value={0}>{t('transfers.allPartnerships')}</option>
            {partnerships.map((w) => <option key={w.id} value={w.id}>{label(w)}</option>)}
          </Select>
        )}
      </div>
      <div className="mb-4">
        <DateRangeFilter range={range} onChange={setRange} />
      </div>

      <TransfersTable rows={pagination.pageRows} nameOf={nameOf} onView={async (row) => setViewing(await transfersApi.get({ id: row.id }))}
        onEdit={async (row) => setForm({ transfer: await transfersApi.get({ id: row.id }) })}
        onDelete={ask}
      />
      <Pagination {...pagination} />

      {form && (
        <Modal title={t(form.transfer ? 'transfers.edit' : 'transfers.add')} onClose={() => setForm(null)} wide>
          <TransferForm active={active} workspaces={workspaces} nameOf={nameOf} initial={form.transfer} onSubmit={save} onCancel={() => setForm(null)} />
        </Modal>
      )}
      {viewing && <TransferDetailsModal transfer={viewing} nameOf={nameOf} onClose={() => setViewing(null)} />}
      {dialog}
    </>
  )
}
