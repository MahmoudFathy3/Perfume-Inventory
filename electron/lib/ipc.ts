import type { IpcMain, IpcMainInvokeEvent } from 'electron'
import { toErrorCode } from './errors'

export type Handler<P, R> = (payload: P, event: IpcMainInvokeEvent) => R | Promise<R>

/**
 * بيلف أي handler: يرجّع { ok: true, data } أو { ok: false, error: 'CODE' }.
 * guard (اختياري): بيتنادى قبل كل أمر باسم القناة، ولو رمى خطأ الأمر بيترفض (بنستخدمه لرفض كل حاجة والتطبيق مقفول).
 */
export function createHandle(ipcMain: Pick<IpcMain, 'handle'>, guard?: (channel: string) => void) {
  return function handle<P = Record<string, never>, R = unknown>(channel: string, fn: Handler<P, R>): void {
    ipcMain.handle(channel, async (event, payload) => {
      try {
        guard?.(channel)
        return { ok: true as const, data: await fn((payload ?? {}) as P, event) }
      } catch (e) {
        return { ok: false as const, error: toErrorCode(e) }
      }
    })
  }
}

export type HandleFn = ReturnType<typeof createHandle>
