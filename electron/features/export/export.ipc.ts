import fs from 'node:fs/promises'
import type { ExportRequest, ExportResult } from '@shared/types'
import type { IpcContext } from '../../lib/context'
import type { HandleFn } from '../../lib/ipc'
import { buildExport, exportData } from './export.service'

const FILTERS = { xlsx: 'Excel', csv: 'CSV' } as const

export function register(handle: HandleFn, { dialog }: IpcContext): void {
  /** تصدير ملف (Excel / CSV): اختيار مكان الحفظ ثم الكتابة */
  handle<ExportRequest, ExportResult>('export:run', async (req) => {
    const built = await buildExport(req)
    const res = await dialog.showSaveDialog({
      defaultPath: `${built.fileName}.${built.ext}`,
      filters: [{ name: FILTERS[req.format], extensions: [built.ext] }]
    })
    if (res.canceled || !res.filePath) return { done: false }
    await fs.writeFile(res.filePath, built.data)
    return { done: true, filePath: res.filePath }
  })

  /** بيانات خام للجدول كله (للـ PDF) */
  handle('export:data', exportData)
}
