import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Customer } from '@shared/types'
import { Field, FormActions, Input } from '@/shared/components/ui'
import { useSubmit } from '@/shared/hooks/useSubmit'

interface CustomerFormProps {
  initial: Customer | null
  onSubmit: (values: { name: string; phone: string }) => Promise<unknown>
  onCancel: () => void
}

export function CustomerForm({ initial, onSubmit, onCancel }: CustomerFormProps) {
  const { t } = useTranslation()
  const [values, setValues] = useState({ name: initial?.name ?? '', phone: initial?.phone ?? '' })
  const { submit, saving } = useSubmit(() => onSubmit(values))

  return (
    <form onSubmit={submit}>
      <Field label={t('common.name')}>
        <Input value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} autoFocus />
      </Field>
      <Field label={t('customers.phone')}>
        <Input value={values.phone} dir="ltr" onChange={(e) => setValues({ ...values, phone: e.target.value })} />
      </Field>
      <FormActions saving={saving} onCancel={onCancel} />
    </form>
  )
}
