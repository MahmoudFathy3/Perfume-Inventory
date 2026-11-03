import path from 'node:path'
import { app, BrowserWindow, Menu } from 'electron'
import { initBackend } from './app/bootstrap'
import { APP_ID, APP_NAME, launchWithSplash } from './windows'
import { denyPermissions } from './windows/security'

// الاسم لازم يتحدد قبل أي استخدام لمسار بيانات التطبيق (userData)
app.setName(APP_NAME)

// وقت التطوير (npm run dev) بيانات منفصلة تمامًا عن النسخة المنصّبة: داتا بيز وكلمة سر وإعدادات ونسخ تلقائية،
// علشان أي تجربة أو migration جديدة متلمسش بيانات الشغل الحقيقية
if (!app.isPackaged) app.setPath('userData', path.join(app.getPath('appData'), `${APP_NAME} (Dev)`))

// ويندوز: بيربط الأيقونة والتجميع في شريط المهام بالتطبيق المنصّب
if (process.platform === 'win32') app.setAppUserModelId(APP_ID)

// حقول الأرقام والتواريخ تظهر بأرقام إنجليزية (يوم/شهر/سنة) بغض النظر عن لغة الويندوز
app.commandLine.appendSwitch('lang', 'en-GB')

let mainWindow: BrowserWindow | null = null

// نسخة واحدة بس من التطبيق: فتحه مرتين ممكن يبوّظ الداتا بيز
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })

  void app.whenReady().then(async () => {
    Menu.setApplicationMenu(null)
    denyPermissions()
    mainWindow = await launchWithSplash(initBackend)
  })

  app.on('window-all-closed', () => app.quit())
}
