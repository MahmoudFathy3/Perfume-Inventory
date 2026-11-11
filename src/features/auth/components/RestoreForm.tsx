import { FolderOpen } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Button, Field, PasswordInput } from '@/shared/components/ui'
import { useSubmit } from '@/shared/hooks/useSubmit'
import { authApi } from '../api/auth.api'
import { useAuth } from '../AuthProvider'
import { AuthShell } from './AuthShell'

/** جهاز جديد: كلمة سر النسخة الاحتياطية، وبعدين اختيار ملفها (والخزنة اللي جنبها) */
export function RestoreForm({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation()
  const { refresh } = useAuth()
  const [password, setPassword] = useState('')
  const { submit, saving } = useSubmit(async () => {
    try {
      await authApi.restore({ password })
    } finally {
      await refresh()
    }
  })

  return (
    <AuthShell title={t('auth.restoreTitle')} subtitle={t('auth.restoreSubtitle')}>
      <form onSubmit={submit}>
        <Field label={t('auth.backupPassword')}>
          <PasswordInput autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Alert tone="info">{t('auth.restoreNote')}</Alert>
        <div className="mt-2 flex gap-2">
          <Button type="submit" variant="primary" icon={FolderOpen} className="flex-1" disabled={saving || !password}>{t('auth.restoreAction')}</Button>
          <Button onClick={onBack}>{t('common.cancel')}</Button>
        </div>
      </form>
    </AuthShell>
  )
}
