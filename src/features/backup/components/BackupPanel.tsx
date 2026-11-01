import { Download, Upload } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { DataTransfer } from '@shared/types'
import { Pagination } from '@/shared/components/data/Pagination'
import { Button, Card, DataTable } from '@/shared/components/ui'
import type { Column } from '@/shared/components/ui'
import { usePagination } from '@/shared/hooks/usePagination'
import { useQuery } from '@/shared/hooks/useQuery'
import { useToast } from '@/shared/toast/ToastProvider'
import { backupApi } from '../api/backup.api'
import { AutoBackupSection } from './AutoBackupSection'

/** عمليات النسخ التلقائي بتتسجل كتصدير بحالة خاصة */
const TYPE_LABEL: Record<string, string> = { auto: 'autoBackup.historyAuto', 'auto-failed': 'autoBackup.historyFailed' }

export function BackupPanel() {
  const { t } = useTranslation()
  const toast = useToast()
  const history = useQuery(() => backupApi.history(), [])
  const pagination = usePagination(history.data ?? [])

  async function run(action: () => Promise<{ done: boolean }>, successText?: string) {
    try {
      const res = await action()
      if (res.done && successText) toast.success(successText)
      history.reload()
    } catch (e) {
      toast.fail(e)
    }
  }

  const doImport = () => window.confirm(t('settings.confirmImport')) && run(backupApi.import)

  const columns: Column<DataTransfer>[] = [
    { key: 'type', header: '', cell: (h) => t(TYPE_LABEL[h.status] ?? (h.type === 'export' ? 'settings.exportType' : 'settings.importType')) },
    { key: 'path', header: '', cell: (h) => <span dir="ltr">{h.file_path}</span> },
    { key: 'date', header: '', cell: (h) => h.created_at }
  ]

  return (
    <Card>
      <h2 className="mb-3">{t('settings.backupTitle')}</h2>
      <div className="flex gap-2">
        <Button variant="primary" icon={Download} onClick={() => run(backupApi.export, t('settings.exportDone'))}>{t('settings.export')}</Button>
        <Button icon={Upload} onClick={doImport}>{t('settings.import')}</Button>
      </div>

      <AutoBackupSection onBackup={history.reload} />

      {pagination.total > 0 && (
        <>
          <h3 className="mb-2 mt-5">{t('settings.history')}</h3>
          <DataTable columns={columns} rows={pagination.pageRows} rowKey={(h) => h.id} />
          <Pagination {...pagination} />
        </>
      )}
    </Card>
  )
}
