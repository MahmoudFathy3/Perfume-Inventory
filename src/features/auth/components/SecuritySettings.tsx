import { Lock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button, Field, Select } from '@/shared/components/ui'
import { useToast } from '@/shared/toast/ToastProvider'
import { authApi } from '../api/auth.api'
import { IDLE_OPTIONS } from '../constants'
import { useAuth } from '../AuthProvider'
import { ChangePasswordForm } from './ChangePasswordForm'
import { NewRecoveryKeyPanel } from './NewRecoveryKeyPanel'

/** محتوى نافذة الأمان في الإعدادات: القفل التلقائي، القفل الآن، كلمة السر، مفتاح الاسترجاع */
export function SecuritySettings() {
  const { t } = useTranslation()
  const toast = useToast()
  const { status, lock, refresh } = useAuth()

  async function changeIdle(minutes: number) {
    try {
      await authApi.setIdle({ minutes })
      await refresh()
      toast.success(t('toast.updated'))
    } catch (e) {
      toast.fail(e)
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-500">{t('auth.securityNote')}</p>

      <div className="flex items-end gap-3">
        <Field label={t('auth.idleLabel')} className="!mb-0 flex-1">
          <Select value={status.idleMinutes} onChange={(e) => changeIdle(Number(e.target.value))}>
            {IDLE_OPTIONS.map((m) => <option key={m} value={m}>{t('auth.idleOption', { count: m })}</option>)}
          </Select>
        </Field>
        <Button icon={Lock} onClick={() => lock().catch(toast.fail)}>{t('auth.lockNow')}</Button>
      </div>

      <ChangePasswordForm />
      <NewRecoveryKeyPanel />
    </div>
  )
}
