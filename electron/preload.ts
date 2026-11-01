import { contextBridge, ipcRenderer } from 'electron'

// الجسر الوحيد بين الواجهة والـ backend: أوامر IPC + إشعار القفل
contextBridge.exposeInMainWorld('api', {
  invoke: (channel: string, payload?: unknown) => ipcRenderer.invoke(channel, payload),
  /** الـ main بيبلّغنا لما التطبيق يتقفل (يدويًا أو بالخمول). بيرجّع دالة لإلغاء الاشتراك. */
  onLocked: (callback: () => void) => {
    const listener = () => callback()
    ipcRenderer.on('auth:locked', listener)
    return () => ipcRenderer.removeListener('auth:locked', listener)
  }
})
