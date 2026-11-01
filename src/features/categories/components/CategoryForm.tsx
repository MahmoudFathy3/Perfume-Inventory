import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Category } from '@shared/types'
import { Field, FormActions, Input } from '@/shared/components/ui'
import { useSubmit } from '@/shared/hooks/useSubmit'

interface CategoryFormProps {
  initial: Category | null
  onSubmit: (values: { name: string }) => Promise<unknown>
  onCancel: () => void
}

export function CategoryForm({ initial, onSubmit, onCancel }: CategoryFormProps) {
  const { t } = useTranslation()
  const [name, setName] = useState(initial?.name ?? '')
  const { submit, saving } = useSubmit(() => onSubmit({ name }))

  return (
    <form onSubmit={submit}>
      <Field label={t('common.name')}>
        <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </Field>
      <FormActions saving={saving} onCancel={onCancel} />
    </form>
  )
}
