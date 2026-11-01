import type { IpcResponse } from '@shared/types'

declare global {
  interface Window {
    /** الجسر اللي بيعمله electron/preload.ts */
    api: {
      invoke: <T = unknown>(channel: string, payload?: unknown) => Promise<IpcResponse<T>>
      /** إشعار من الـ main لما التطبيق يتقفل. بيرجّع دالة لإلغاء الاشتراك. */
      onLocked: (callback: () => void) => () => void
    }
  }
}

export {}
