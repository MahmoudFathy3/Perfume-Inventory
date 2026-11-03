import path from 'node:path'
import { app, BrowserWindow } from 'electron'
import iconPath from '../../resources/icon.png?asset'
import { APP_NAME, MAIN_WINDOW } from './constants'
import { appEntryUrl, devToolsEnabled, lockDownWebContents } from './security'

export interface MainWindowHandle {
  window: BrowserWindow
  /** بتتحقق لما الصفحة تجهز (بعد أول رسم) أو لو التحميل فشل */
  ready: Promise<void>
}

/** النافذة الرئيسية: بتتعمل مخفية، وبتظهر بعد ما الـ Splash تخلص (شوف launch.ts) */
export function createMainWindow(): MainWindowHandle {
  const window = new BrowserWindow({
    ...MAIN_WINDOW,
    show: false,
    title: APP_NAME,
    icon: iconPath,
    backgroundColor: '#f1f5f9',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true, // الواجهة معزولة عن Electron والـ Node
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      spellcheck: false,
      devTools: devToolsEnabled()
    }
  })
  // نسخة التطوير: العنوان بيقول DEV علشان متتلخبطش مع النسخة المنصّبة (بياناتها منفصلة، شوف main.ts)
  if (!app.isPackaged) {
    window.setTitle(`${APP_NAME} — DEV`)
    window.on('page-title-updated', (e) => e.preventDefault())
  }

  const indexHtml = path.join(__dirname, '../renderer/index.html')
  lockDownWebContents(window.webContents, appEntryUrl(indexHtml))

  if (process.env['ELECTRON_RENDERER_URL']) {
    void window.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void window.loadFile(indexHtml)
  }

  const ready = new Promise<void>((resolve) => {
    window.once('ready-to-show', () => resolve())
    window.webContents.once('did-fail-load', () => resolve()) // مانسيبش الـ Splash معلّقة لو التحميل فشل
  })
  return { window, ready }
}
