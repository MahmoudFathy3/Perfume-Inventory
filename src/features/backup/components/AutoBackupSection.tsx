import { useEffect, useState } from 'react'
import { FolderOpen, RefreshCw, RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { AutoBackupStatus } from '@shared/types'
import { Alert, Button, Field, Select } from '@/shared/components/ui'
import { useToast } from '@/shared/toast/ToastProvider'
import { backupApi } from '../api/backup.api'

const KEEP_OPTIONS = [7, 14, 30, 60, 90]

/** النسخ الاحتياطي التلقائي: نسخة كل يوم في فولدر بتختاره (فلاشة أو فولدر Google Drive مثلًا) */
export function AutoBackupSection({ onBackup }: { onBackup?: () => void }) {
  const { t } = useTranslation()
  const toast = useToast()
  const [status, setStatus] = useState<AutoBackupStatus | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    backupApi.autoStatus().then(setStatus).catch(toast.fail)
  }, [toast])

  async function run(action: () => Promise<AutoBackupStatus>, successText?: string) {
    setBusy(true)
    try {
      setStatus(await action())
      if (successText) toast.success(successText)
    } catch (e) {
      toast.fail(e)
    } finally {
      setBusy(false)
      onBackup?.()
    }
  }

  if (!status) return null

  return (
    <div className="mt-5 border-t border-slate-200 pt-4">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h3>{t('autoBackup.title')}</h3>
        <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            className="h-4 w-4 accent-primary-600"
            checked={status.enabled}
            disabled={busy}
            onChange={(e) => run(() => backupApi.autoUpdate({ enabled: e.target.checked }), t('toast.updated'))}
          />
          {t('autoBackup.enabled')}
        </label>
      </div>
      <p className="mb-3 text-sm text-slate-500">{t('autoBackup.note')}</p>

      <Field label={t('autoBackup.folder')}>
        <div className="flex items-center gap-2">
          <span dir="ltr" className="min-w-0 flex-1 truncate rounded-xl bg-slate-50 px-3 py-2 text-start text-sm" title={status.dir}>{status.dir}</span>
          <Button icon={FolderOpen} disabled={busy} onClick={() => run(backupApi.autoChooseDir)}>{t('autoBackup.chooseFolder')}</Button>
          {!status.isDefaultDir && (
            <Button variant="ghost" icon={RotateCcw} disabled={busy} onClick={() => run(backupApi.autoResetDir)}>{t('autoBackup.defaultFolder')}</Button>
          )}
        </div>
      </Field>
      {status.isDefaultDir && <Alert tone="warning">{t('autoBackup.defaultFolderWarning')}</Alert>}

      <div className="flex flex-wrap items-end gap-3">
        <Field label={t('autoBackup.keep')} className="!mb-0 w-48">
          <Select value={status.keep} disabled={busy} onChange={(e) => run(() => backupApi.autoUpdate({ keep: Number(e.target.value) }), t('toast.updated'))}>
            {KEEP_OPTIONS.map((n) => <option key={n} value={n}>{t('autoBackup.keepOption', { count: n })}</option>)}
          </Select>
        </Field>
        <Button icon={RefreshCw} disabled={busy} onClick={() => run(backupApi.autoRunNow, t('autoBackup.done'))}>{t('autoBackup.runNow')}</Button>
      </div>

      <p className="mt-3 text-sm text-slate-500">
        {status.lastAt
          ? t('autoBackup.last', { date: new Date(status.lastAt).toLocaleString('en-GB'), count: status.count })
          : t('autoBackup.never')}
      </p>
    </div>
  )
}
