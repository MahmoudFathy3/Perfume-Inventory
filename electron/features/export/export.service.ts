import type { ExportRequest, ExportSheet } from '@shared/types'
import { today } from '../../lib/errors'
import { buildCsv, buildXlsx } from './export.builders'
import { loadSheets } from './datasets'

export interface BuiltExport {
  data: Buffer | string
  /** الامتداد (xlsx / csv) */
  ext: string
  /** اسم الملف الافتراضي */
  fileName: string
}

/** كل بيانات الـ dataset (بيستخدمها التصدير لـ PDF من الواجهة) */
export const exportData = (req: Pick<ExportRequest, 'dataset' | 'search' | 'itemId' | 'partnerId' | 'from' | 'to'>): ExportSheet[] => loadSheets(req.dataset, req)

export async function buildExport(req: ExportRequest): Promise<BuiltExport> {
  const fileName = `${req.labels.sheets[req.dataset] ?? req.dataset}-${today()}`
  const sheets = loadSheets(req.dataset, req) // كل الشيتات (الجدول وتفاصيله)

  if (req.format === 'csv') return { data: buildCsv(sheets, req.labels), ext: 'csv', fileName }
  return { data: await buildXlsx(sheets, req.labels, req.rtl ?? false), ext: 'xlsx', fileName }
}
