import path from 'node:path'
import type { HandleFn } from '../../lib/ipc'
import type { IpcContext } from '../../lib/context'
import * as auto from './autoBackup.service'
import * as backup from './backup.service'

/** كل قد إيه بنشوف لو جه وقت النسخة التلقائية (والتطبيق مفتوح) */
const AUTO_CHECK_MS = 60 * 60 * 1000

export function register(handle: HandleFn, { dialog, app, config, session }: IpcContext): void {
  const autoDeps = (): auto.AutoBackupDeps => ({
    config,
    defaultDir: path.join(app.getPath('userData'), 'auto-backups'),
    exportVault: (to) => session.exportVault(to)
  })

  // النسخة التلقائية: بعد فتح التطبيق بكلمة السر، وكل ساعة طول ما هو مفتوح (لو مر يوم من آخر نسخة)
  const autoIfDue = () => {
    if (session.state() !== 'unlocked') return
    try {
      auto.runAutoBackup(autoDeps())
    } catch {
      // الفشل اتسجل في السجل، والمستخدم يقدر يشوفه في الإعدادات
    }
  }
  session.onUnlock(autoIfDue)
  setInterval(autoIfDue, AUTO_CHECK_MS).unref()

  handle('backup:export', async () => {
    const res = await dialog.showSaveDialog({
      defaultPath: backup.defaultExportName(),
      filters: [{ name: 'SQLite', extensions: ['sqlite'] }]
    })
    if (res.canceled || !res.filePath) return { done: false }
    backup.exportTo(res.filePath, config.read().dbPath, (to) => session.exportVault(to))
    return { done: true, filePath: res.filePath }
  })

  handle('backup:import', async () => {
    const res = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'SQLite', extensions: ['sqlite', 'db'] }]
    })
    if (res.canceled) return { done: false }
    backup.importFrom(res.filePaths[0], config.read().dbPath, session.dbKey())
    app.relaunch()
    app.exit(0)
    return { done: true }
  })

  handle('backup:history', () => backup.listTransfers())

  // ---------- النسخ التلقائي ----------
  handle('backup:autoStatus', () => auto.autoBackupStatus(autoDeps()))
  handle('backup:autoUpdate', (patch: { enabled?: boolean; keep?: number }) => {
    auto.updateAutoBackup(config, { enabled: patch.enabled, keep: patch.keep })
    return auto.autoBackupStatus(autoDeps())
  })
  handle('backup:autoChooseDir', async () => {
    const res = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] })
    if (!res.canceled) auto.updateAutoBackup(config, { dir: res.filePaths[0] })
    return auto.autoBackupStatus(autoDeps())
  })
  handle('backup:autoResetDir', () => {
    auto.updateAutoBackup(config, { dir: '' })
    return auto.autoBackupStatus(autoDeps())
  })
  handle('backup:autoRunNow', () => {
    auto.runAutoBackup(autoDeps(), { force: true })
    return auto.autoBackupStatus(autoDeps())
  })
}
