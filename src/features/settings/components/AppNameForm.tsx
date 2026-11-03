import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Field, Input } from '@/shared/components/ui'
import { saveAppName, useAppName } from '@/shared/hooks/useAppName'
import { useSubmit } from '@/shared/hooks/useSubmit'
import { useToast } from '@/shared/toast/ToastProvider'

/** اسم البرنامج: بيظهر في القايمة الجانبية وشاشة الدخول وشاشة البداية وعنوان النافذة. الفاضي = الاسم الافتراضي. */
export function AppNameForm({ onSaved }: { onSaved?: () => void }) {
  const { t } = useTranslation()
  const toast = useToast()
  const { custom } = useAppName()
  const [name, setName] = useState(custom)

  const { submit, saving } = useSubmit(async () => {
    await saveAppName(name)
    toast.success(t('toast.saved'))
    onSaved?.()
  })

  return (
    <form onSubmit={submit}>
      <Field label={t('settings.appName')}>
        <Input value={name} maxLength={40} placeholder={t('app.name')} onChange={(e) => setName(e.target.value)} autoFocus />
      </Field>
      <p className="mb-3.5 text-sm text-slate-500">{t('settings.appNameNote')}</p>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={saving}>{t('common.save')}</Button>
        {custom && (
          <Button disabled={saving} onClick={() => setName('')}>{t('settings.appNameReset')}</Button>
        )}
      </div>
    </form>
  )
}
