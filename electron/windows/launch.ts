import type { BrowserWindow } from 'electron'
import { SPLASH_DURATION_MS } from './constants'
import { createMainWindow } from './main.window'
import { createSplashWindow } from './splash.window'

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * تشغيل التطبيق:
 * 1. تظهر شاشة البداية (Splash).
 * 2. وإحنا ظاهرين بنجهّز الـ backend (الداتا بيز والـ IPC) ونحمّل النافذة الرئيسية مخفية.
 * 3. بعد SPLASH_DURATION_MS (3 ثواني) **وبعد ما النافذة الرئيسية تجهز** → الـ Splash تختفي وبعدها تظهر النافذة الرئيسية.
 */
export async function launchWithSplash(boot: () => void | Promise<void>): Promise<BrowserWindow> {
  const splash = createSplashWindow()
  await splash.shown
  const minimumShown = sleep(SPLASH_DURATION_MS)

  await boot()
  const main = createMainWindow()

  await Promise.all([main.ready, minimumShown])

  // الـ Splash تختفي الأول، وبعدها تظهر النافذة الرئيسية
  splash.window.destroy()
  main.window.maximize() // بتملا الشاشة كلها (عرض وطول) مع بقاء شريط العنوان وشريط المهام
  main.window.show()
  main.window.focus()
  return main.window
}
