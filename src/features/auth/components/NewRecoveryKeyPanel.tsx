import { Copy, KeyRound } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { invoke } from '@/shared/api/ipc'
import { Alert, Button, Field, Input } from '@/shared/components/ui'
import { useSubmit } from '@/shared/hooks/useSubmit'
import { useToast } from '@/shared/toast/ToastProvider'
import { authApi } from '../api/auth.api'
import { RecoveryKeyBox } from './RecoveryKeyBox'

/** مفتاح استرجاع جديد (القديم بيبطل). بيظهر مرة واحدة بعد تأكيد كلمة السر. */
export function NewRecoveryKeyPanel() {
  const { t } = useTranslation()
  const toast = useToast()
  const [password, setPassword] = useState('')
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null)
  const { submit, saving } = useSubmit(async () => {
    const res = await authApi.newRecoveryKey({ password })
    setRecoveryKey(res.recoveryKey)
    setPassword('')
  })

  if (recoveryKey) {
    return (
      <div>
        <h3 className="mb-2 font-bold">{t('auth.newRecoveryKey')}</h3>
        <RecoveryKeyBox recoveryKey={recoveryKey} />
        <Alert tone="warning">{t('auth.recoveryWarning')}</Alert>
        <div className="flex gap-2">
          <Button icon={Copy} onClick={() => invoke('clipboard:writeText', { text: recoveryKey }).then(() => toast.success(t('auth.copied'))).catch(toast.fail)}>{t('auth.copyKey')}</Button>
          <Button variant="primary" onClick={() => setRecoveryKey(null)}>{t('auth.recoverySavedDone')}</Button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={submit}>
      <h3 className="mb-2 font-bold">{t('auth.newRecoveryKey')}</h3>
      <p className="mb-2 text-sm text-slate-500">{t('auth.newRecoveryKeyNote')}</p>
      <Field label={t('auth.currentPassword')}>
        <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <Button type="submit" icon={KeyRound} disabled={saving || !password}>{t('auth.newRecoveryKeyAction')}</Button>
    </form>
  )
}
