import { KeyRound } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Button, Field, Modal, PasswordInput } from '@/shared/components/ui'
import { useToast } from '@/shared/toast/ToastProvider'
import { backupApi } from '../api/backup.api'

/**
 * النسخة اللي اخترتها من جهاز تاني (مشفّرة بمفتاحه): بنطلب كلمة سر الجهاز القديم أو مفتاح الاسترجاع بتاعه.
 * البرنامج بيعيد تشفيرها بمفتاح الجهاز ده وبيعيد التشغيل، وكلمة سر الجهاز ده بتفضل زي ما هي.
 */
export function ForeignBackupDialog({ hasVault, onClose }: { hasVault: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const toast = useToast()
  const [secret, setSecret] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await backupApi.importForeign({ secret }) // لو نجح البرنامج بيعيد التشغيل
    } catch (err) {
      toast.fail(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={t('settings.foreignTitle')} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <p className="text-sm text-slate-600">{t('settings.foreignNote')}</p>
        <Field label={t('settings.foreignSecret')}>
          <PasswordInput autoFocus value={secret} onChange={(e) => setSecret(e.target.value)} />
        </Field>
        <small className="-mt-2 text-slate-500">{t('settings.foreignSecretHint')}</small>
        {!hasVault && <Alert tone="warning">{t('settings.foreignNoVault')}</Alert>}
        <Alert tone="info">{t('settings.foreignKeepPassword')}</Alert>
        <div className="flex gap-2">
          <Button type="submit" variant="primary" icon={KeyRound} disabled={busy || !secret}>{t('settings.foreignImport')}</Button>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
        </div>
      </form>
    </Modal>
  )
}
