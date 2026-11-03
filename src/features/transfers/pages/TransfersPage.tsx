import { FilterX, Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Transfer, TransferDetails, TransferInput, TransferKind, TransfersFilter } from '@shared/types'
import { Pagination } from '@/shared/components/data/Pagination'
import { SearchBar } from '@/shared/components/data/SearchBar'
import { Alert, Button, Card, Field, Input, Modal, PageHeader, Select } from '@/shared/components/ui'
import { useConfirmDelete } from '@/shared/hooks/useConfirmDelete'
import { useToast } from '@/shared/toast/ToastProvider'
import { formatMoney } from '@/shared/utils/format'
import { CollectDialog } from '../../customers'
import type { CollectValues } from '../../customers'
import { useWorkspaces } from '../../workspaces'
import { transfersApi } from '../api/transfers.api'
import { TransferDetailsModal } from '../components/TransferDetailsModal'
import { TransferForm } from '../components/TransferForm'
import { transferRemaining } from '../components/TransferPaymentStatus'
import { TransfersSummary } from '../components/TransfersSummary'
import { TransfersTable } from '../components/TransfersTable'
import { useTransfers } from '../hooks/useTransfers'

const KINDS: TransferKind[] = ['capital', 'sale', 'half']
const NO_FILTER: Required<TransfersFilter> = { search: '', kind: '', direction: '', from: '', to: '', payment: '' }

/** التحويل بين المخزون الفعلي والشراكات (رأس مال / بيع / بالنص) */
export default function TransfersPage() {
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const { workspaces, active, label } = useWorkspaces()
  const [form, setForm] = useState<{ transfer: TransferDetails | null } | null>(null) // transfer = null: تحويل جديد
  const [viewing, setViewing] = useState<TransferDetails | null>(null)
  const [paying, setPaying] = useState<Transfer | null>(null)
  const [filter, setFilter] = useState(NO_FILTER)
  const pagination = useTransfers(filter)
  const [version, setVersion] = useState(0) // بيتغيّر بعد أي حفظ علشان الملخص يتحدّث
  const reload = () => {
    pagination.reload()
    setVersion((v) => v + 1)
  }

  const nameOf = (id: number) => {
    const ws = workspaces.find((w) => w.id === id)
    return ws ? label(ws) : `#${id}`
  }

  const set = <K extends keyof TransfersFilter>(key: K) => (value: Required<TransfersFilter>[K]) => {
    const next = { ...filter, [key]: value }
    // الفترة: "من" بعد "إلى" بتتصلّح بدل ما الجدول يفضى
    if (key === 'from' && next.to && next.from > next.to) next.to = next.from
    if (key === 'to' && next.from && next.to < next.from) next.from = next.to
    setFilter(next)
  }
  const filtered = JSON.stringify(filter) !== JSON.stringify(NO_FILTER)

  async function save(payload: TransferInput) {
    const editing = form?.transfer
    if (editing) await transfersApi.update({ id: editing.id, ...payload })
    else await transfersApi.create(payload)
    toast.success(t(editing ? 'toast.updated' : 'toast.created'))
    setForm(null)
    reload()
  }

  async function pay(row: Transfer, values: CollectValues) {
    await transfersApi.pay({ transfer_id: row.id, ...values })
    toast.success(t('toast.saved'))
    setPaying(null)
    reload()
  }

  // حذف التحويل بيرجّع القطع للمخزن اللي خرجت منه (ويترفض لو الوجهة باعتها)
  const { ask, dialog } = useConfirmDelete<Transfer>(
    async (row) => {
      await transfersApi.remove({ id: row.id })
      toast.success(t('toast.deleted'))
      reload()
    },
    {
      getName: (row) => `#${row.id} — ${nameOf(row.from_workspace_id)} ← ${nameOf(row.to_workspace_id)}`,
      note: t('transfers.deleteNote'),
      getWarning: (row) => (row.paid > 0 ? t('transfers.deletePaymentsWarning', { amount: formatMoney(row.paid, i18n.language) }) : null)
    }
  )

  return (
    <>
      <PageHeader title={t('transfers.title')}>
        <SearchBar value={filter.search} onChange={set('search')} />
        <Button variant="primary" icon={Plus} onClick={() => setForm({ transfer: null })}>{t('transfers.add')}</Button>
      </PageHeader>

      <Card className="mb-3.5 flex flex-wrap items-end gap-3.5 !py-3.5">
        <Field label={t('transfers.kind')} className="!mb-0">
          <Select value={filter.kind} onChange={(e) => set('kind')(e.target.value as TransferKind | '')}>
            <option value="">{t('transfers.allKinds')}</option>
            {KINDS.map((k) => <option key={k} value={k}>{t(`transfers.kinds.${k}`)}</option>)}
          </Select>
        </Field>
        <Field label={t('transfers.direction')} className="!mb-0">
          <Select value={filter.direction} onChange={(e) => set('direction')(e.target.value as 'out' | 'in' | '')}>
            <option value="">{t('transfers.allDirections')}</option>
            <option value="out">{t('transfers.out', { name: label(active) })}</option>
            <option value="in">{t('transfers.in', { name: label(active) })}</option>
          </Select>
        </Field>
        <Field label={t('transfers.payment')} className="!mb-0">
          <Select value={filter.payment} onChange={(e) => set('payment')(e.target.value as 'paid' | 'unpaid' | '')}>
            <option value="">{t('transfers.allPayments')}</option>
            <option value="unpaid">{t('transfers.unpaid')}</option>
            <option value="paid">{t('transfers.paidFull')}</option>
          </Select>
        </Field>
        <Field label={t('common.from')} className="!mb-0">
          <Input type="date" value={filter.from} onChange={(e) => set('from')(e.target.value)} />
        </Field>
        <Field label={t('common.to')} className="!mb-0">
          <Input type="date" value={filter.to} onChange={(e) => set('to')(e.target.value)} />
        </Field>
        {filtered && (
          <Button variant="ghost" icon={FilterX} className="ms-auto" onClick={() => setFilter(NO_FILTER)}>{t('transfers.clearFilters')}</Button>
        )}
      </Card>

      <TransfersSummary filter={filter} storeName={label(active)} refreshKey={version} />

      <TransfersTable
        rows={pagination.pageRows}
        nameOf={nameOf}
        activeId={active.id}
        onPay={setPaying}
        onView={async (row) => setViewing(await transfersApi.get({ id: row.id }))}
        onEdit={async (row) => setForm({ transfer: await transfersApi.get({ id: row.id }) })}
        onDelete={ask}
      />
      <Pagination {...pagination} />

      {form && (
        <Modal title={form.transfer ? `${t('transfers.edit')} #${form.transfer.id}` : t('transfers.add')} onClose={() => setForm(null)} wide>
          {form.transfer && <Alert tone="info">{t('transfers.editNote')}</Alert>}
          <TransferForm active={active} workspaces={workspaces} nameOf={nameOf} initial={form.transfer} onSubmit={save} onCancel={() => setForm(null)} />
        </Modal>
      )}
      {paying && (
        <CollectDialog
          title={t(paying.from_workspace_id === active.id ? 'transfers.collectTitle' : 'transfers.payTitle', { id: paying.id })}
          subject={`${nameOf(paying.from_workspace_id)} ← ${nameOf(paying.to_workspace_id)}${paying.partner_name ? ` · ${paying.partner_name}` : ''}`}
          remaining={transferRemaining(paying)}
          note={t('transfers.paymentNote')}
          submitLabel={t('transfers.confirmPayment')}
          onSubmit={(values) => pay(paying, values)}
          onClose={() => setPaying(null)}
        />
      )}
      {viewing && <TransferDetailsModal transfer={viewing} nameOf={nameOf} onClose={() => setViewing(null)} />}
      {dialog}
    </>
  )
}
