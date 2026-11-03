import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Field, FormActions, Input } from '@/shared/components/ui'
import { useSubmit } from '@/shared/hooks/useSubmit'
import { useToast } from '@/shared/toast/ToastProvider'
import { workspacesApi } from '../api/workspaces.api'
import { useWorkspaces } from '../WorkspaceProvider'

/** تحديد / تغيير صاحب المخزون الفعلي (اسمه بيتغيّر في كل شراكاته) */
export function OwnerForm({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const { t } = useTranslation()
  const toast = useToast()
  const { owner, reload } = useWorkspaces()
  const [name, setName] = useState(owner ?? '')
  const { submit, saving } = useSubmit(async () => {
    await workspacesApi.setOwner({ name })
    await reload()
    toast.success(t('toast.saved'))
    onSaved()
  })

  return (
    <form onSubmit={submit}>
      <Field label={t('workspaces.ownerName')}>
        <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </Field>
      <p className="mb-4 text-sm text-slate-500">{t('workspaces.ownerHint')}</p>
      <FormActions saving={saving} onCancel={onCancel} />
    </form>
  )
}
