import fs from 'node:fs'
import path from 'node:path'
import { app, BrowserWindow, clipboard, dialog, ipcMain, powerMonitor, shell } from 'electron'
import { createConfig } from '../config/appConfig'
import { ENV } from '../config/env'
import { closeDb, encryptInPlace, getDb, isPlaintextDb, openDb } from '../database/connection'
import { migrate } from '../database/migrate'
import { registerAll } from '../features'
import { Session } from '../security/session'
import { renderHtmlToImage } from '../windows/capture.window'
import { hideWhatsApp, shareOnWhatsApp } from '../windows/whatsapp.window'
import { createVaultStore } from '../security/vaultStore'

/** تجهيز الـ backend: الإعدادات + كلمة السر + أوامر الـ IPC. الداتا بيز بتتفتح بعد إدخال كلمة السر بس. */
export function initBackend(): void {
  const userData = app.getPath('userData')
  const config = createConfig(userData, ENV.dbFileName)

  const session = new Session({
    store: createVaultStore(path.join(userData, 'vault.json')),
    openDatabase(key) {
      const { dbPath } = config.read()
      fs.mkdirSync(path.dirname(dbPath), { recursive: true })
      // داتا بيز قديمة من قبل كلمة السر: بتتشفّر في مكانها مرة واحدة
      if (fs.existsSync(dbPath) && isPlaintextDb(dbPath)) encryptInPlace(dbPath, key)
      openDb(dbPath, key)
      migrate(getDb())
    },
    closeDatabase: closeDb
  })

  // القفل (يدوي أو بالخمول) بيوصل للواجهة علشان تظهر شاشة كلمة السر
  session.onLock(() => BrowserWindow.getAllWindows().forEach((w) => w.webContents.send('auth:locked')))
  // قفل شاشة ويندوز أو نوم الجهاز = قفل التطبيق
  powerMonitor.on('lock-screen', () => session.lock())
  powerMonitor.on('suspend', () => session.lock())

  // قفل البرنامج بيخفي نافذة واتساب كمان (المحادثات متفضلش ظاهرة)
  session.onLock(hideWhatsApp)

  registerAll({ ipcMain, dialog, app, config, clipboard, shell, capture: renderHtmlToImage, whatsapp: shareOnWhatsApp, session })
}
