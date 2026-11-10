import type { App, Clipboard, Dialog, IpcMain, NativeImage, Shell } from 'electron'
import type { AppConfig } from '../config/appConfig'
import type { Session } from '../security/session'
import type { WhatsAppShareOptions } from '../windows/whatsapp.window'

/** الحاجات اللي بتتبعت لكل feature وقت تسجيل الـ IPC */
export interface IpcContext {
  ipcMain: IpcMain
  dialog: Dialog
  app: App
  config: AppConfig
  clipboard: Pick<Clipboard, 'writeText' | 'writeImage'>
  /** فتح روابط برا التطبيق (واتساب) وإظهار ملف في الفولدر بتاعه */
  shell: Pick<Shell, 'openExternal' | 'showItemInFolder'>
  /** رسم HTML في نافذة مخفية وتصويره (صورة الفاتورة) */
  capture: (html: string, dir: string) => Promise<NativeImage>
  /** فتح واتساب ويب جوه البرنامج على الشات وحط الفاتورة فيه */
  whatsapp: (options: WhatsAppShareOptions) => Promise<void>
  /** كلمة السر والقفل */
  session: Session
}
