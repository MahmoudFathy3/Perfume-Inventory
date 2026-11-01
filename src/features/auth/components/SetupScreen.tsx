import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RotateCcw } from 'lucide-react'
import { Alert, Button, Field, Input } from '@/shared/components/ui'
import { useSubmit } from '@/shared/hooks/useSubmit'
import { useAuth } from '../AuthProvider'
import { AuthShell } from './AuthShell'
import { MIN_PASSWORD_LENGTH } from '../constants'
import { RestoreForm } from './RestoreForm'

/** أول تشغيل: اختيار كلمة السر (البيانات بتتشفّر بيها) */
export function SetupScreen() {
  const { t } = useTranslation()
  const { setup } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [restoring, setRestoring] = useState(false)
  const { submit, saving } = useSubmit(async () => {
    if (password !== confirm) throw new Error('PASSWORD_MISMATCH')
    await setup(password)
  })

  if (restoring) return <RestoreForm onBack={() => setRestoring(false)} />

  return (
    <AuthShell title={t('auth.setupTitle')} subtitle={t('auth.setupSubtitle')}>
      <form onSubmit={submit}>
        <Field label={t('auth.password')}>
          <Input type="password" autoFocus autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label={t('auth.confirmPassword')}>
          <Input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        <Alert tone="info">{t('auth.setupNote', { min: MIN_PASSWORD_LENGTH })}</Alert>
        <Button type="submit" variant="primary" className="mt-2 w-full" disabled={saving}>{t('auth.setupAction')}</Button>
      </form>
      <Button variant="link" icon={RotateCcw} className="mx-auto mt-4 flex" onClick={() => setRestoring(true)}>{t('auth.restoreLink')}</Button>
    </AuthShell>
  )
}
