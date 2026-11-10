import fs from 'node:fs'
import path from 'node:path'
import type { DataTransfer } from '@shared/types'
import { closeDb, createDatabase, encryptInPlace, execute, getDb, isPlaintextDb, openDb, queryAll, rekeyInPlace } from '../../database/connection'
import type { Db } from '../../database/connection'
import { migrate } from '../../database/migrate'
import { AppError } from '../../lib/errors'

const REQUIRED_TABLES = ['categories', 'items', 'item_stock', 'purchases', 'sales', 'returns', 'settings']

export const logTransfer = (type: 'export' | 'import', filePath: string, status: string) =>
  void execute('INSERT INTO data_transfers(type, file_path, status) VALUES (?, ?, ?)', [type, filePath, status])

export const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
export const defaultExportName = () => `inventory-backup-${stamp()}.sqlite`

/**
 * التصدير: نسخة كاملة من ملف الداتا بيز (بتفضل مشفّرة بنفس المفتاح).
 * الاستعلامات متزامنة فمفيش عملية كتابة شغالة وقت النسخ.
 */
export const vaultCopyPath = (filePath: string) => `${filePath}.vault.json`

/** status: 'success' للتصدير اليدوي و'auto' للنسخ التلقائي (بيظهر كده في السجل) */
export function exportTo(filePath: string, currentDbPath: string, exportVault?: (to: string) => void, status = 'success'): void {
  fs.copyFileSync(currentDbPath, filePath)
  exportVault?.(vaultCopyPath(filePath)) // الخزنة جنب النسخة: علشان تتفتح على جهاز جديد بكلمة السر
  logTransfer('export', filePath, status)
}

/**
 * نتأكد إن الملف داتا بيز بتاعتنا (ومشفّرة بمفتاحنا أو عادية قديمة) قبل ما نستبدل بيه.
 * ملف مشفّر بمفتاح تاني = BACKUP_KEY_MISMATCH.
 */
export function validateDbFile(filePath: string, key?: string): void {
  let probe: Db | undefined
  try {
    const plain = isPlaintextDb(filePath)
    try {
      probe = createDatabase(filePath, { readonly: true, fileMustExist: true }, plain ? undefined : key)
    } catch (e) {
      throw plain ? e : new AppError('BACKUP_KEY_MISMATCH')
    }
    const names = new Set((probe.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]).map((r) => r.name))
    if (!REQUIRED_TABLES.every((t) => names.has(t))) throw new AppError('INVALID_BACKUP_FILE')
  } catch (e) {
    if (e instanceof AppError) throw e
    throw new AppError('INVALID_BACKUP_FILE')
  } finally {
    probe?.close()
  }
}

/** الاستيراد: نسخة أمان من الداتا الحالية، وبعدين الاستبدال (النسخة العادية القديمة بتتشفّر بمفتاحنا) */
export function importFrom(srcPath: string, currentDbPath: string, key?: string): { safetyPath: string } {
  validateDbFile(srcPath, key)
  const safetyPath = path.join(path.dirname(currentDbPath), `before-import-${stamp()}.sqlite`)

  closeDb()
  fs.copyFileSync(currentDbPath, safetyPath)
  fs.copyFileSync(srcPath, currentDbPath)
  if (key && isPlaintextDb(currentDbPath)) encryptInPlace(currentDbPath, key)

  openDb(currentDbPath, key)
  migrate(getDb()) // لو النسخة قديمة نحدّثها لآخر هيكل
  logTransfer('import', srcPath, 'success')
  return { safetyPath }
}

/**
 * استيراد نسخة من جهاز تاني (مشفّرة بمفتاح الجهاز ده): foreignKey = مفتاحها اللي طلع من خزنتها بكلمة سرها.
 * النسخة بتتنسخ جنب الداتا بيز وبيتغيّر مفتاحها لمفتاح الجهاز ده، وبعدين بتحل محل الداتا الحالية (بعد نسخة أمان منها).
 * كلمة سر الجهاز ده بتفضل زي ما هي.
 */
export function importForeign(srcPath: string, foreignKey: string, currentDbPath: string, key: string): { safetyPath: string } {
  validateDbFile(srcPath, foreignKey) // الخزنة دي مش بتاعة النسخة دي = BACKUP_KEY_MISMATCH
  const incoming = `${currentDbPath}.incoming`
  fs.copyFileSync(srcPath, incoming)
  try {
    rekeyInPlace(incoming, foreignKey, key)
    validateDbFile(incoming, key)
  } catch (e) {
    fs.rmSync(incoming, { force: true })
    throw e
  }

  const safetyPath = path.join(path.dirname(currentDbPath), `before-import-${stamp()}.sqlite`)
  closeDb()
  fs.copyFileSync(currentDbPath, safetyPath)
  fs.renameSync(incoming, currentDbPath)
  openDb(currentDbPath, key)
  migrate(getDb())
  logTransfer('import', srcPath, 'success')
  return { safetyPath }
}

/** نقل ملف الداتا بيز لفولدر تاني */
export function moveDatabase(currentDbPath: string, newDbPath: string, key?: string): void {
  if (fs.existsSync(newDbPath)) throw new AppError('TARGET_EXISTS')
  fs.mkdirSync(path.dirname(newDbPath), { recursive: true })
  closeDb()
  fs.copyFileSync(currentDbPath, newDbPath)
  openDb(newDbPath, key)
  logTransfer('export', newDbPath, 'moved')
}

export const listTransfers = () => queryAll<DataTransfer>('SELECT * FROM data_transfers ORDER BY id DESC LIMIT 20')
