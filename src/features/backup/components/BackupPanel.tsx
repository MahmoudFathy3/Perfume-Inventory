import { Download, Upload } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { DataTransfer } from '@shared/types'
import { ConfirmActionDialog } from '@/shared/components/data/ConfirmActionDialog'
import { Pagination } from '@/shared/components/data/Pagination'
import { Button, Card, DataTable } from '@/shared/components/ui'
import type { Column } from '@/shared/components/ui'
import { usePagination } from '@/shared/hooks/usePagination'
import { useQuery } from '@/shared/hooks/useQuery'
import { useToast } from '@/shared/toast/ToastProvider'
import { backupApi } from '../api/backup.api'
import { AutoBackupSection } from './AutoBackupSection'
import { ForeignBackupDialog } from './ForeignBackupDialog'

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

  // نسخة من جهاز تاني: بنطلب كلمة سره (hasVault = الخزنة جنب النسخة، وإلا هيطلب يختارها)
  const [foreign, setForeign] = useState<{ hasVault: boolean } | null>(null)

  const [confirmingImport, setConfirmingImport] = useState(false)

  /** بعد التأكيد: اختيار الملف والاستيراد (البرنامج بيعيد التشغيل لو نجح، أو بيطلب كلمة سر لو النسخة من جهاز تاني) */
  async function doImport() {
    const res = await backupApi.import()
    setConfirmingImport(false)
    if (res.foreign) setForeign({ hasVault: !!res.hasVault })
  }

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
        <Button icon={Upload} onClick={() => setConfirmingImport(true)}>{t('settings.import')}</Button>
      </div>

      <AutoBackupSection onBackup={history.reload} />

      {pagination.total > 0 && (
        <>
          <h3 className="mb-2 mt-5">{t('settings.history')}</h3>
          <DataTable columns={columns} rows={pagination.pageRows} rowKey={(h) => h.id} />
          <Pagination {...pagination} />
        </>
      )}
      {confirmingImport && (
        <ConfirmActionDialog
          title={t('settings.importTitle')}
          question={t('settings.importQuestion')}
          effects={[t('settings.importReplace'), t('settings.importSafety'), t('settings.importRestart'), t('settings.importForeignNote')]}
          confirmLabel={t('settings.importAction')}
          icon={Upload}
          tone="danger"
          onConfirm={doImport}
          onCancel={() => setConfirmingImport(false)}
        />
      )}
      {foreign && <ForeignBackupDialog hasVault={foreign.hasVault} onClose={() => setForeign(null)} />}
    </Card>
  )
}
