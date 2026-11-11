import fs from 'node:fs'
import path from 'node:path'
import type { IpcContext } from '../../lib/context'
import { AppError } from '../../lib/errors'
import type { HandleFn } from '../../lib/ipc'
import { parseVault } from '../../security/vaultStore'
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

  /**
   * نسخة من جهاز تاني مستنية كلمة سرها (الملف بيتحفظ هنا في الـ main، والواجهة بتبعت كلمة السر بس).
   * بتبطل بعد 15 دقيقة أو أول استيراد ناجح.
   */
  let pendingForeign: { file: string; vault: string | null; at: number } | null = null
  const PENDING_MS = 15 * 60 * 1000

  handle('backup:import', async () => {
    const res = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'SQLite', extensions: ['sqlite', 'db'] }]
    })
    if (res.canceled) return { done: false }
    const file = res.filePaths[0]
    try {
      backup.importFrom(file, config.read().dbPath, session.dbKey())
    } catch (e) {
      // مشفّرة بمفتاح جهاز تاني: محتاجين خزنتها (جنبها) وكلمة سر الجهاز ده القديم
      if (!(e instanceof AppError) || e.code !== 'BACKUP_KEY_MISMATCH') throw e
      const vault = fs.existsSync(backup.vaultCopyPath(file)) ? backup.vaultCopyPath(file) : null
      pendingForeign = { file, vault, at: Date.now() }
      return { done: false, foreign: true, hasVault: vault !== null }
    }
    app.relaunch()
    app.exit(0)
    return { done: true }
  })

  /** الخطوة التانية لنسخة جهاز تاني: كلمة سره القديمة أو مفتاح استرجاعه (والخزنة لو مش جنب النسخة) */
  handle('backup:import-foreign', async ({ secret }: { secret: string }) => {
    if (!pendingForeign || Date.now() - pendingForeign.at > PENDING_MS) throw new AppError('IMPORT_EXPIRED')
    if (!pendingForeign.vault) {
      const res = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'Vault', extensions: ['json'] }] })
      if (res.canceled) return { done: false }
      pendingForeign.vault = res.filePaths[0]
    }
    let vault
    try {
      vault = parseVault(fs.readFileSync(pendingForeign.vault, 'utf8'))
    } catch {
      pendingForeign.vault = null // تختار ملف تاني المرة الجاية
      throw new AppError('INVALID_VAULT_FILE')
    }
    const foreignKey = session.foreignBackupKey(vault, secret)
    backup.importForeign(pendingForeign.file, foreignKey, config.read().dbPath, session.dbKey())
    pendingForeign = null
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
