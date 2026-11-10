import fs from 'node:fs'
import Database from 'better-sqlite3-multiple-ciphers'
import { normalizeArabic } from '../lib/normalizeArabic'

export type Db = Database.Database
type Params = Record<string, unknown> | unknown[]

let db: Db | null = null

/**
 * فتح أي داتا بيز SQLite. الاختبارات بتحدد BETTER_SQLITE3_BINDING علشان تستخدم نسخة من الملف الأصلي
 * مبنية لـ Node العادي، من غير ما تلمس النسخة اللي التطبيق (Electron) بيستخدمها.
 */
export function createDatabase(file: string, options: Database.Options = {}, key?: string): Db {
  // بيتحط جوه أمر PRAGMA، فلازم يكون hex بس. بنتأكد قبل ما نفتح الملف علشان مفيش اتصال يفضل مفتوح.
  if (key && !/^[0-9a-f]{64}$/.test(key)) throw new Error('INVALID_DB_KEY')
  const nativeBinding = process.env.BETTER_SQLITE3_BINDING
  const conn = new Database(file, nativeBinding ? { ...options, nativeBinding } : options)
  if (key) applyKey(conn, key)
  return conn
}

/**
 * مفتاح التشفير: 64 حرف hex (256 بت) بيتمرر لـ SQLCipher كمفتاح خام.
 * لو المفتاح غلط أو الملف مش مشفّر بيرمي خطأ هنا، مش في أول استعلام.
 */
function applyKey(conn: Db, key: string): void {
  try {
    conn.pragma("cipher = 'sqlcipher'")
    conn.pragma(`key = "x'${key}'"`)
    conn.prepare('SELECT count(*) FROM sqlite_master').get()
  } catch (e) {
    conn.close()
    throw e
  }
}

/** الملف داتا بيز SQLite عادية (غير مشفّرة)؟ بنعرف من أول 16 بايت */
export function isPlaintextDb(file: string): boolean {
  const fd = fs.openSync(file, 'r')
  try {
    const head = Buffer.alloc(16)
    fs.readSync(fd, head, 0, 16, 0)
    return head.toString('latin1') === 'SQLite format 3\0'
  } finally {
    fs.closeSync(fd)
  }
}

/** تشفير داتا بيز عادية في مكانها بالمفتاح ده (بيحصل مرة واحدة عند تفعيل كلمة السر) */
export function encryptInPlace(file: string, key: string): void {
  if (!/^[0-9a-f]{64}$/.test(key)) throw new Error('INVALID_DB_KEY')
  const conn = createDatabase(file)
  try {
    conn.pragma("cipher = 'sqlcipher'")
    conn.pragma(`rekey = "x'${key}'"`)
  } finally {
    conn.close()
  }
}

/** تغيير مفتاح تشفير داتا بيز مشفّرة في مكانها (نسخة من جهاز تاني بتتشفّر بمفتاح الجهاز ده) */
export function rekeyInPlace(file: string, oldKey: string, newKey: string): void {
  if (!/^[0-9a-f]{64}$/.test(newKey)) throw new Error('INVALID_DB_KEY')
  const conn = createDatabase(file, {}, oldKey)
  try {
    conn.pragma(`rekey = "x'${newKey}'"`)
  } finally {
    conn.close()
  }
}

export function openDb(file: string, key?: string): Db {
  db = createDatabase(file, {}, key)
  db.pragma('foreign_keys = ON')
  // دالة للبحث العربي: بتوحّد الحروف قبل المقارنة
  db.function('norm', { deterministic: true }, (v: unknown) => normalizeArabic(v))
  return db
}

export function getDb(): Db {
  if (!db) throw new Error('DB_NOT_OPEN')
  return db
}

export function closeDb(): void {
  if (db) db.close()
  db = null
}

// ---------- أدوات صغيرة بتقلل التكرار في الـ repositories ----------
const bind = (params: Params): unknown[] => (Array.isArray(params) ? params : [params])

/** كل الصفوف */
export const queryAll = <T>(sql: string, params: Params = {}): T[] => getDb().prepare(sql).all(...bind(params)) as T[]

/** أول صف أو undefined */
export const queryOne = <T>(sql: string, params: Params = {}): T | undefined =>
  getDb().prepare(sql).get(...bind(params)) as T | undefined

/** تنفيذ أمر (INSERT / UPDATE / DELETE) وبيرجّع الـ id لو كان INSERT */
export const execute = (sql: string, params: Params = {}): number =>
  Number(getDb().prepare(sql).run(...bind(params)).lastInsertRowid)
