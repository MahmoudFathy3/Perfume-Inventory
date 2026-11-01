import type { App, Clipboard, Dialog, IpcMain } from 'electron'
import type { AppConfig } from '../config/appConfig'
import type { Session } from '../security/session'

/** الحاجات اللي بتتبعت لكل feature وقت تسجيل الـ IPC */
export interface IpcContext {
  ipcMain: IpcMain
  dialog: Dialog
  app: App
  config: AppConfig
  clipboard: Pick<Clipboard, 'writeText'>
  /** كلمة السر والقفل */
  session: Session
}
