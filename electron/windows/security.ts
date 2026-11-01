import { pathToFileURL } from 'node:url'
import { app, session } from 'electron'
import type { WebContents } from 'electron'

/** رابط الصفحة الرئيسية للتطبيق (الوحيد المسموح التنقل ليه) */
export function appEntryUrl(indexHtml: string): string {
  return process.env['ELECTRON_RENDERER_URL'] ?? pathToFileURL(indexHtml).href
}

/**
 * تشديد النافذة:
 * - مفيش فتح نوافذ جديدة ولا تنقل لأي رابط برا التطبيق (الصفحة مبتخرجش لإنترنت).
 * - الحماية في webPreferences (contextIsolation / sandbox / من غير Node) بتتحدد وقت إنشاء النافذة.
 */
export function lockDownWebContents(contents: WebContents, entryUrl: string): void {
  const base = entryUrl.split('#')[0]
  contents.setWindowOpenHandler(() => ({ action: 'deny' }))
  contents.on('will-navigate', (event, url) => {
    if (!url.startsWith(base)) event.preventDefault()
  })
  contents.on('will-attach-webview', (event) => event.preventDefault())
}

/** صلاحيات المتصفح (كاميرا / مايك / موقع...) كلها مرفوضة: التطبيق مش محتاج أي منها */
export function denyPermissions(): void {
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
  session.defaultSession.setPermissionCheckHandler(() => false)
}

/** أدوات المطور شغالة في التطوير بس. في النسخة المنصّبة مقفولة (F12 وCtrl+Shift+I مبيفتحوش حاجة). */
export const devToolsEnabled = (): boolean => !app.isPackaged
