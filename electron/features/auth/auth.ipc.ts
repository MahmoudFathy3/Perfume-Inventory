import type { AuthStatus } from '@shared/types'
import fs from 'node:fs'
import path from 'node:path'
import type { IpcContext } from '../../lib/context'
import { createDatabase } from '../../database/connection'
import { AppError } from '../../lib/errors'
import type { HandleFn } from '../../lib/ipc'
import { parseVault } from '../../security/vaultStore'
import { vaultCopyPath } from '../backup/backup.service'

/** كلمة السر والقفل. دي القنوات الوحيدة المسموحة والتطبيق مقفول (باقي الأوامر بتترفض LOCKED). */
export function register(handle: HandleFn, { session, dialog, config }: IpcContext): void {
  handle<unknown, AuthStatus>('auth:status', () => session.status())
  handle('auth:setup', ({ password }: { password: string }) => ({ recoveryKey: session.setup(password) }))
  handle('auth:unlock', ({ password }: { password: string }) => session.unlock(password))
  handle('auth:recover', ({ recoveryKey, password }: { recoveryKey: string; password: string }) => ({ recoveryKey: session.recover(recoveryKey, password) }))
  handle('auth:lock', () => session.lock())
  handle('auth:ping', () => session.touch())
  handle('auth:change-password', ({ current, next }: { current: string; next: string }) => session.changePassword(current, next))
  handle('auth:new-recovery-key', ({ password }: { password: string }) => ({ recoveryKey: session.newRecoveryKey(password) }))
  handle('auth:set-idle', ({ minutes }: { minutes: number }) => session.setIdleMinutes(minutes))

  // جهاز جديد: نسخة احتياطية (.sqlite) + الخزنة اللي جنبها (.sqlite.vault.json) + كلمة السر
  handle('auth:restore', async ({ password }: { password: string }) => {
    const pick = async (name: string, extensions: string[]) => {
      const res = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name, extensions }] })
      return res.canceled ? null : res.filePaths[0]
    }
    const dbFile = await pick('SQLite', ['sqlite', 'db'])
    if (!dbFile) return { done: false }
    const vaultFile = fs.existsSync(vaultCopyPath(dbFile)) ? vaultCopyPath(dbFile) : await pick('Vault', ['json'])
    if (!vaultFile) return { done: false }

    let vault
    try {
      vault = parseVault(fs.readFileSync(vaultFile, 'utf8'))
    } catch {
      throw new AppError('INVALID_BACKUP_FILE')
    }
    session.restore(vault, password, (dbKey) => {
      const target = config.read().dbPath
      fs.mkdirSync(path.dirname(target), { recursive: true })
      if (fs.existsSync(target)) fs.renameSync(target, `${target}.before-restore`)
      fs.copyFileSync(dbFile, target)
      try {
        createDatabase(target, { readonly: true }, dbKey).close() // نتأكد إن المفتاح بيفتح الملف ده فعلًا
      } catch {
        fs.rmSync(target, { force: true })
        throw new AppError('BACKUP_KEY_MISMATCH')
      }
    })
    return { done: true }
  })
}
