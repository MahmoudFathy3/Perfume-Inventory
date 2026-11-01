import { Copy } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Button } from '@/shared/components/ui'
import { invoke } from '@/shared/api/ipc'
import { useToast } from '@/shared/toast/ToastProvider'
import { useAuth } from '../AuthProvider'
import { AuthShell } from './AuthShell'
import { RecoveryKeyBox } from './RecoveryKeyBox'

/** مفتاح الاسترجاع بيظهر مرة واحدة: التطبيق مبيكملش غير لما المستخدم يأكد إنه حفظه */
export function RecoveryKeyScreen({ recoveryKey }: { recoveryKey: string }) {
  const { t } = useTranslation()
  const toast = useToast()
  const { confirmRecoveryKey } = useAuth()
  const [saved, setSaved] = useState(false)

  return (
    <AuthShell title={t('auth.recoveryTitle')} subtitle={t('auth.recoverySubtitle')}>
      <RecoveryKeyBox recoveryKey={recoveryKey} />
      <Button
        icon={Copy}
        className="mt-3 w-full"
        onClick={() => invoke('clipboard:writeText', { text: recoveryKey }).then(() => toast.success(t('auth.copied'))).catch(toast.fail)}
      >
        {t('auth.copyKey')}
      </Button>
      <Alert tone="warning">{t('auth.recoveryWarning')}</Alert>
      <label className="mb-4 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="h-4 w-4" />
        {t('auth.recoverySaved')}
      </label>
      <Button variant="primary" className="w-full" disabled={!saved} onClick={confirmRecoveryKey}>{t('auth.continue')}</Button>
    </AuthShell>
  )
}
