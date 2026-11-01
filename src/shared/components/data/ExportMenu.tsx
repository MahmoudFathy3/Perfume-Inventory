import { Download, FileDown, FileSpreadsheet, FileText } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ExportFormat } from '@shared/types'
import { useExport } from '../../export/useExport'
import type { ExportTarget } from '../../export/useExport'
import { useToast } from '../../toast/ToastProvider'
import { DropdownMenu } from '../ui'

/** زرار "تصدير" بقايمة: Excel / CSV / PDF. بيصدّر الجدول كله (مش الصفحة الحالية بس) بنفس البحث. */
export function ExportMenu({ target }: { target: ExportTarget }) {
  const { t } = useTranslation()
  const toast = useToast()
  const { exportFile, exportPdf } = useExport()

  async function run(format: ExportFormat | 'pdf') {
    try {
      if (format === 'pdf') return await exportPdf(target)
      const res = await exportFile(target, format)
      if (res.done) toast.success(t('toast.exported'))
    } catch (e) {
      toast.fail(e)
    }
  }

  return (
    <DropdownMenu
      icon={Download}
      label={t('export.button')}
      items={[
        { key: 'xlsx', label: t('export.xlsx'), icon: FileSpreadsheet, onSelect: () => void run('xlsx') },
        { key: 'csv', label: t('export.csv'), icon: FileText, onSelect: () => void run('csv') },
        { key: 'pdf', label: t('export.pdf'), icon: FileDown, onSelect: () => void run('pdf') }
      ]}
    />
  )
}
