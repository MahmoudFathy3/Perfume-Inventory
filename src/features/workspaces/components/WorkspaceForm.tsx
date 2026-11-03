import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Workspace, WorkspaceInput } from '@shared/types'
import { Field, FormActions, Input } from '@/shared/components/ui'
import { useSubmit } from '@/shared/hooks/useSubmit'
import { workspacesApi } from '../api/workspaces.api'
import { useWorkspaces } from '../WorkspaceProvider'

interface WorkspaceFormProps {
  initial: Workspace | null
  /** شراكة أو مخزن خارجي (وقت التعديل بيتاخد من initial) */
  kind?: 'partnership' | 'warehouse'
  onSubmit: (values: WorkspaceInput) => Promise<unknown>
  onCancel: () => void
}

/**
 * شراكة بين شريكين بالنص: صاحب المخزون الفعلي + شريك تاني، واسم للشراكة اختياري (بيفرّق بين شراكتين لنفس الشخص).
 * المخزن الخارجي: اسمه بس.
 */
export function WorkspaceForm({ initial, kind = 'partnership', onSubmit, onCancel }: WorkspaceFormProps) {
  return (initial?.kind ?? kind) === 'warehouse' ? <WarehouseForm initial={initial} onSubmit={onSubmit} onCancel={onCancel} /> : <PartnershipForm initial={initial} onSubmit={onSubmit} onCancel={onCancel} />
}

function WarehouseForm({ initial, onSubmit, onCancel }: WorkspaceFormProps) {
  const { t } = useTranslation()
  const [name, setName] = useState(initial?.name ?? '')
  const { submit, saving } = useSubmit(() => onSubmit({ kind: 'warehouse', name }))

  return (
    <form onSubmit={submit}>
      <Field label={t('workspaces.warehouseName')}>
        <Input value={name} placeholder={t('workspaces.warehouseNameHint')} onChange={(e) => setName(e.target.value)} autoFocus />
      </Field>
      <p className="mb-4 text-sm text-slate-500">{t('workspaces.warehouseNote')}</p>
      <FormActions saving={saving} onCancel={onCancel} />
    </form>
  )
}

/**
 * صاحب المخزون الفعلي شريك ثابت: بيتكتب لوحده ومبيتعدّلش هنا (بيتغيّر من صف المخزون الفعلي)، والمستخدم بيضيف الشريك التاني بس.
 * لو صاحب المخزون لسه متحددش: أول خانة "اسمك" وبتتحفظ صاحب المخزون مع الشراكة.
 * شراكة قديمة صاحب المخزون مش فيها: الاسمين بيتكتبوا زي الأول.
 */
function PartnershipForm({ initial, onSubmit, onCancel }: WorkspaceFormProps) {
  const { t } = useTranslation()
  const { owner } = useWorkspaces()
  const [name, setName] = useState(initial?.name ?? '')
  const ownerIndex = initial ? initial.partners.findIndex((p) => p.is_owner) : owner ? 0 : -1
  const [partners, setPartners] = useState(
    initial ? [initial.partners[0]?.name ?? '', initial.partners[1]?.name ?? ''] : [owner ?? '', '']
  )
  const askOwner = !initial && !owner // أول شراكة: بنسأل عن اسم صاحب المخزون
  const { submit, saving } = useSubmit(async () => {
    if (askOwner) await workspacesApi.setOwner({ name: partners[0] })
    await onSubmit({ name, partners })
  })
  const setPartner = (index: number, value: string) => setPartners(partners.map((p, i) => (i === index ? value : p)))

  const partnerField = (index: number) => {
    if (index === ownerIndex) {
      return (
        <Field key={index} label={t('workspaces.owner')}>
          <Input readOnly value={partners[index]} className="bg-slate-50" />
          <small className="text-slate-500">{t('workspaces.ownerFixed')}</small>
        </Field>
      )
    }
    const label = askOwner && index === 0 ? t('workspaces.yourName') : ownerIndex >= 0 ? t('workspaces.otherPartner') : t(index === 0 ? 'workspaces.partnerA' : 'workspaces.partnerB')
    const focus = ownerIndex >= 0 ? true : index === 0
    return (
      <Field key={index} label={label}>
        <Input value={partners[index]} onChange={(e) => setPartner(index, e.target.value)} autoFocus={focus} />
        {askOwner && index === 0 && <small className="text-slate-500">{t('workspaces.yourNameHint')}</small>}
      </Field>
    )
  }

  return (
    <form onSubmit={submit}>
      <div className="grid grid-cols-2 gap-3">
        {partnerField(0)}
        {partnerField(1)}
      </div>
      <Field label={t('workspaces.name')}>
        <Input value={name} placeholder={t('workspaces.nameHint')} onChange={(e) => setName(e.target.value)} />
      </Field>
      <p className="mb-4 text-sm text-slate-500">{t('workspaces.splitNote')}</p>
      <FormActions saving={saving} onCancel={onCancel} />
    </form>
  )
}
