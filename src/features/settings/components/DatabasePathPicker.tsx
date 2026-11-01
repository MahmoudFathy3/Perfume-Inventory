import { FolderOpen } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button, Field } from '@/shared/components/ui'
import { useQuery } from '@/shared/hooks/useQuery'
import { useToast } from '@/shared/toast/ToastProvider'
import { settingsApi } from '../api/settings.api'

export function DatabasePathPicker() {
  const { t } = useTranslation()
  const toast = useToast()
  const { data: dbPath } = useQuery(() => settingsApi.getDbPath(), [])

  async function change() {
    try {
      await settingsApi.changeDbPath() // التطبيق بيعيد التشغيل لو اتغير
    } catch (e) {
      toast.fail(e)
    }
  }

  return (
    <Field label={t('settings.databasePath')}>
      <code dir="ltr" className="break-all rounded-xl bg-slate-100 px-3 py-2.5">{dbPath}</code>
      <div className="mt-1"><Button icon={FolderOpen} onClick={change}>{t('settings.changePath')}</Button></div>
      <small className="text-slate-500">{t('settings.changePathNote')}</small>
    </Field>
  )
}
