import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { ExportDataset, ExportFormat, ExportLabels, ExportParams, ExportResult, ExportSheet } from '@shared/types'
import { getLanguage } from '@/i18n/languages'
import { invoke } from '../api/ipc'
import { usePrint } from '../print/PrintProvider'
import { PrintableReport } from './PrintableReport'

export interface ExportTarget extends ExportParams {
  dataset: ExportDataset
}

/** ترجمات عناوين الأعمدة وقيم الحالات بلغة التطبيق (بتتبعت للـ backend) */
function useExportLabels(): ExportLabels {
  const { t, i18n } = useTranslation()
  return useMemo(() => {
    const get = (key: string) => t(key, { returnObjects: true }) as unknown as Record<string, string>
    return { sheets: get('export.sheets'), columns: get('export.columns'), values: get('export.values') }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, i18n.language])
}

/** تصدير جدول: Excel أو CSV (الـ backend بيكتب الملف) أو PDF (بنطبعه من الواجهة) */
export function useExport() {
  const { i18n } = useTranslation()
  const labels = useExportLabels()
  const { savePdf } = usePrint()
  const lang = i18n.language

  async function exportFile(target: ExportTarget, format: ExportFormat): Promise<ExportResult> {
    return invoke<ExportResult>('export:run', { ...target, format, labels, rtl: getLanguage(lang).dir === 'rtl' })
  }

  async function exportPdf(target: ExportTarget): Promise<void> {
    const sheets = await invoke<ExportSheet[]>('export:data', target) // كل الجداول (الأساسي وتفاصيله)
    const title = labels.sheets[target.dataset] ?? target.dataset
    await savePdf(<PrintableReport title={title} sheets={sheets} labels={labels} lang={lang} />, title)
  }

  return { exportFile, exportPdf }
}
