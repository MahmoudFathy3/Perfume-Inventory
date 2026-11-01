import { useState } from 'react'
import type { ReactNode } from 'react'
import { ConfirmDialog } from '../components/data/ConfirmDialog'
import { useToast } from '../toast/ToastProvider'

interface Options<T> {
  /** اسم العنصر اللي بيظهر في النافذة */
  getName?: (row: T) => ReactNode
  /** ملاحظة ثابتة تحت الاسم */
  note?: ReactNode
  /** تحذير بيعتمد على العنصر (مثلًا: عنده كمية في المخزن) */
  getWarning?: (row: T) => ReactNode
}

/**
 * الحذف بتأكيد: ask(row) يفتح النافذة. لو الحذف فشل (مثلًا مستخدم في فواتير) بيظهر toast والنافذة بتفضل مفتوحة.
 * remove بتعمل الحذف وتظهر رسالة النجاح (toast.success) بنفسها.
 *   const { ask, dialog } = useConfirmDelete<Row>(async (row) => { await api.remove(...); reload() }, { getName: (r) => r.name })
 */
export function useConfirmDelete<T>(remove: (row: T) => Promise<unknown>, options: Options<T> = {}) {
  const toast = useToast()
  const [row, setRow] = useState<T | null>(null)
  const [busy, setBusy] = useState(false)

  async function confirm() {
    if (!row) return
    setBusy(true)
    try {
      await remove(row)
      setRow(null)
    } catch (e) {
      toast.fail(e)
    } finally {
      setBusy(false)
    }
  }

  const dialog = row ? (
    <ConfirmDialog detail={options.getName?.(row)} note={options.note} warning={options.getWarning?.(row)} busy={busy} onConfirm={confirm} onCancel={() => setRow(null)} />
  ) : null

  return { ask: setRow, dialog }
}
