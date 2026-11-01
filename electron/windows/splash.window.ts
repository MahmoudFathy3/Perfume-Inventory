import { app, BrowserWindow } from 'electron'
import logoSvg from '../../resources/icon.svg?raw'
import iconPath from '../../resources/icon.png?asset'
import { APP_NAME, APP_NAME_AR, SPLASH_DURATION_MS, SPLASH_WINDOW } from './constants'
import { buildSplashHtml } from './splash.html'

export interface SplashHandle {
  window: BrowserWindow
  /** بتتحقق لما الـ Splash تظهر فعلًا على الشاشة */
  shown: Promise<void>
}

/** شاشة البداية: بدون إطار، مش بتتحرك، فوق كل حاجة */
export function createSplashWindow(): SplashHandle {
  const window = new BrowserWindow({
    ...SPLASH_WINDOW,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    center: true,
    show: false,
    icon: iconPath,
    title: APP_NAME,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, devTools: false }
  })

  const html = buildSplashHtml({ name: APP_NAME, subtitle: APP_NAME_AR, version: app.getVersion(), logoSvg, durationMs: SPLASH_DURATION_MS })
  void window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)

  const shown = new Promise<void>((resolve) => {
    window.once('ready-to-show', () => {
      window.show()
      resolve()
    })
  })
  return { window, shown }
}
