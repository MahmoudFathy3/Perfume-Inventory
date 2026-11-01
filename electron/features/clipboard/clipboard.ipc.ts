import type { IpcContext } from '../../lib/context'
import type { HandleFn } from '../../lib/ipc'

/** نسخ نص للـ clipboard (بيستخدمه زرار "نسخ قائمة المنتجات") */
export function register(handle: HandleFn, { clipboard }: IpcContext): void {
  handle<{ text: string }, void>('clipboard:writeText', ({ text }) => clipboard.writeText(String(text ?? '')))
}
