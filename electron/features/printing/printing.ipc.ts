import fs from 'node:fs/promises'
import type { IpcContext } from '../../lib/context'
import type { HandleFn } from '../../lib/ipc'

/** حفظ الصفحة الحالية كـ PDF (الواجهة بتعرض الفاتورة أو الجدول في منطقة الطباعة قبل ما تنادي) */
export function register(handle: HandleFn, { dialog }: IpcContext): void {
  handle<{ defaultName?: string }, { done: boolean; filePath?: string }>('print:pdf', async ({ defaultName }, event) => {
    const res = await dialog.showSaveDialog({
      defaultPath: `${defaultName || 'document'}.pdf`,
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    })
    if (res.canceled || !res.filePath) return { done: false }
    const pdf = await event.sender.printToPDF({ pageSize: 'A4', printBackground: true })
    await fs.writeFile(res.filePath, pdf)
    return { done: true, filePath: res.filePath }
  })
}
