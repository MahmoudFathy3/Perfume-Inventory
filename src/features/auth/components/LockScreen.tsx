import { KeyRound, LockOpen } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Button, Field, Input } from '@/shared/components/ui'
import { useSubmit } from '@/shared/hooks/useSubmit'
import { useAuth } from '../AuthProvider'
import { AuthShell } from './AuthShell'
import { RecoverForm } from './RecoverForm'

/** شاشة كلمة السر (والتطبيق مقفول). بعد محاولات غلط كتير بيظهر عدّاد انتظار. */
export function LockScreen() {
  const { t } = useTranslation()
  const { status, unlock, refresh } = useAuth()
  const [password, setPassword] = useState('')
  const [recovering, setRecovering] = useState(false)
  const { submit, saving } = useSubmit(async () => {
    try {
      await unlock(password)
    } catch (e) {
      setPassword('')
      throw e
    }
  })

  // عدّاد الانتظار: بنحدّث الحالة كل ثانية لحد ما يخلص
  const waiting = status.waitSeconds > 0
  useEffect(() => {
    if (!waiting) return
    const timer = setInterval(() => void refresh(), 1000)
    return () => clearInterval(timer)
  }, [waiting, refresh])

  if (recovering) return <RecoverForm onBack={() => setRecovering(false)} />

  return (
    <AuthShell title={t('auth.lockedTitle')} subtitle={t('auth.lockedSubtitle')}>
      <form onSubmit={submit}>
        <Field label={t('auth.password')}>
          <Input type="password" autoFocus autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={waiting} />
        </Field>
        {waiting && <Alert tone="warning">{t('auth.wait', { seconds: status.waitSeconds })}</Alert>}
        <Button type="submit" variant="primary" icon={LockOpen} className="w-full" disabled={saving || waiting || !password}>{t('auth.unlock')}</Button>
      </form>
      <Button variant="link" icon={KeyRound} className="mx-auto mt-4 flex" onClick={() => setRecovering(true)}>{t('auth.forgot')}</Button>
    </AuthShell>
  )
}
