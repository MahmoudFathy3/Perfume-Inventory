import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Workspace, WorkspaceInput } from '@shared/types'
import { Field, FormActions, Input } from '@/shared/components/ui'
import { useSubmit } from '@/shared/hooks/useSubmit'

interface WorkspaceFormProps {
  initial: Workspace | null
  onSubmit: (values: WorkspaceInput) => Promise<unknown>
  onCancel: () => void
}

/** شراكة بين شريكين بالنص: اسمين، واسم للشراكة اختياري (بيفرّق بين شراكتين لنفس الشخص) */
export function WorkspaceForm({ initial, onSubmit, onCancel }: WorkspaceFormProps) {
  const { t } = useTranslation()
  const [name, setName] = useState(initial?.name ?? '')
  const [partners, setPartners] = useState([initial?.partners[0]?.name ?? '', initial?.partners[1]?.name ?? ''])
  const { submit, saving } = useSubmit(() => onSubmit({ name, partners }))
  const setPartner = (index: number, value: string) => setPartners(partners.map((p, i) => (i === index ? value : p)))

  return (
    <form onSubmit={submit}>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('workspaces.partnerA')}>
          <Input value={partners[0]} onChange={(e) => setPartner(0, e.target.value)} autoFocus />
        </Field>
        <Field label={t('workspaces.partnerB')}>
          <Input value={partners[1]} onChange={(e) => setPartner(1, e.target.value)} />
        </Field>
      </div>
      <Field label={t('workspaces.name')}>
        <Input value={name} placeholder={t('workspaces.nameHint')} onChange={(e) => setName(e.target.value)} />
      </Field>
      <p className="mb-4 text-sm text-slate-500">{t('workspaces.splitNote')}</p>
      <FormActions saving={saving} onCancel={onCancel} />
    </form>
  )
}
