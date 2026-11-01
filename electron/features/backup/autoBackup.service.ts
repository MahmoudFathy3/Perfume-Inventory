import fs from 'node:fs'
import path from 'node:path'
import type { AutoBackupStatus } from '@shared/types'
import type { AppConfig } from '../../config/appConfig'
import { AppError } from '../../lib/errors'
import { exportTo, logTransfer, stamp, vaultCopyPath } from './backup.service'

const PREFIX = 'auto-backup-'
const FILE_RE = /^auto-backup-[\d-]+\.sqlite$/
/** أقل مدة بين نسختين تلقائيتين */
export const AUTO_BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000
export const KEEP_OPTIONS = [7, 14, 30, 60, 90] as const

export interface AutoBackupDeps {
  config: AppConfig
  /** الفولدر الافتراضي (جوه بيانات التطبيق) لو المستخدم مااختارش فولدر */
  defaultDir: string
  /** نسخة الخزنة جنب النسخة (من غيرها النسخة مبتتفتحش على جهاز تاني) */
  exportVault: (to: string) => void
  now?: () => number
}

const dirOf = ({ config, defaultDir }: AutoBackupDeps) => config.read().autoBackupDir || defaultDir

/** النسخ التلقائية في الفولدر من الأقدم للأحدث (التاريخ في الاسم فالترتيب الأبجدي = ترتيب زمني) */
function listBackups(dir: string): string[] {
  try {
    return fs.readdirSync(dir).filter((f) => FILE_RE.test(f)).sort()
  } catch {
    return [] // الفولدر لسه متعملش أو الفلاشة مش متوصّلة
  }
}

function lastBackupTime(dir: string): number | null {
  const newest = listBackups(dir).at(-1)
  if (!newest) return null
  try {
    return fs.statSync(path.join(dir, newest)).mtimeMs
  } catch {
    return null
  }
}

export function autoBackupStatus(deps: AutoBackupDeps): AutoBackupStatus {
  const { autoBackupEnabled, autoBackupDir, autoBackupKeep } = deps.config.read()
  const dir = dirOf(deps)
  const last = lastBackupTime(dir)
  return {
    enabled: autoBackupEnabled,
    dir,
    isDefaultDir: !autoBackupDir,
    keep: autoBackupKeep,
    lastAt: last === null ? null : new Date(last).toISOString(),
    count: listBackups(dir).length
  }
}

export function updateAutoBackup(config: AppConfig, patch: { enabled?: boolean; keep?: number; dir?: string }): void {
  if (patch.keep !== undefined && !KEEP_OPTIONS.includes(patch.keep as (typeof KEEP_OPTIONS)[number])) throw new AppError('INVALID_NUMBER')
  config.write({
    ...(patch.enabled !== undefined && { autoBackupEnabled: Boolean(patch.enabled) }),
    ...(patch.keep !== undefined && { autoBackupKeep: patch.keep }),
    ...(patch.dir !== undefined && { autoBackupDir: String(patch.dir) })
  })
}

/** بيمسح الأقدم لحد ما يفضل keep نسخة (والخزنة اللي جنب كل نسخة) */
function prune(dir: string, keep: number): void {
  const files = listBackups(dir)
  for (const name of files.slice(0, Math.max(0, files.length - keep))) {
    const file = path.join(dir, name)
    fs.rmSync(file, { force: true })
    fs.rmSync(vaultCopyPath(file), { force: true })
  }
}

/**
 * نسخة تلقائية لو مر يوم من آخر نسخة (أو force للنسخ دلوقتي من الإعدادات).
 * بيرجّع مسار النسخة، أو null لو مكانش وقتها. الفشل بيتسجل في السجل وبيترمي.
 */
export function runAutoBackup(deps: AutoBackupDeps, { force = false } = {}): string | null {
  const { dbPath, autoBackupEnabled, autoBackupKeep } = deps.config.read()
  if (!force && !autoBackupEnabled) return null
  const dir = dirOf(deps)
  const now = (deps.now ?? Date.now)()
  const last = lastBackupTime(dir)
  if (!force && last !== null && now - last < AUTO_BACKUP_INTERVAL_MS) return null

  const file = path.join(dir, `${PREFIX}${stamp()}.sqlite`)
  try {
    fs.mkdirSync(dir, { recursive: true })
    exportTo(file, dbPath, deps.exportVault, 'auto')
  } catch (e) {
    fs.rmSync(file, { force: true }) // منسيبش نسخة ناقصة
    logTransfer('export', file, 'auto-failed')
    throw e instanceof AppError ? e : new AppError('AUTO_BACKUP_FAILED')
  }
  prune(dir, autoBackupKeep)
  return file
}
