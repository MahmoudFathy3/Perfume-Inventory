import { contextBridge, ipcRenderer } from 'electron'

// الجسر الوحيد بين الواجهة والـ backend: أوامر IPC + إشعار القفل
contextBridge.exposeInMainWorld('api', {
  /** وضع التطوير: داتا بيز منفصلة عن البرودكشن (شوف electron/config/runtime.ts) */
  // لازم تطابق DEV_ARG في electron/config/runtime.ts (الـ preload مينفعش يستورد app)
  isDev: process.argv.includes('--perfume-dev'),
  invoke: (channel: string, payload?: unknown) => ipcRenderer.invoke(channel, payload),
  /** الـ main بيبلّغنا لما التطبيق يتقفل (يدويًا أو بالخمول). بيرجّع دالة لإلغاء الاشتراك. */
  onLocked: (callback: () => void) => {
    const listener = () => callback()
    ipcRenderer.on('auth:locked', listener)
    return () => ipcRenderer.removeListener('auth:locked', listener)
  }
})
