import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Field, Input, PasswordInput } from '@/shared/components/ui'
import { useSubmit } from '@/shared/hooks/useSubmit'
import { useAuth } from '../AuthProvider'
import { AuthShell } from './AuthShell'

/** نسيت كلمة السر: مفتاح الاسترجاع + كلمة سر جديدة */
export function RecoverForm({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation()
  const { recover } = useAuth()
  const [recoveryKey, setRecoveryKey] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const { submit, saving } = useSubmit(async () => {
    if (password !== confirm) throw new Error('PASSWORD_MISMATCH')
    await recover(recoveryKey, password)
  })

  return (
    <AuthShell title={t('auth.recoverTitle')} subtitle={t('auth.recoverSubtitle')}>
      <form onSubmit={submit}>
        <Field label={t('auth.recoveryKey')}>
          <Input dir="ltr" autoFocus placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX" value={recoveryKey} onChange={(e) => setRecoveryKey(e.target.value)} />
        </Field>
        <Field label={t('auth.newPassword')}>
          <PasswordInput autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label={t('auth.confirmPassword')}>
          <PasswordInput autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        <div className="mt-2 flex gap-2">
          <Button type="submit" variant="primary" className="flex-1" disabled={saving || !recoveryKey}>{t('auth.recoverAction')}</Button>
          <Button onClick={onBack}>{t('common.cancel')}</Button>
        </div>
      </form>
    </AuthShell>
  )
}
