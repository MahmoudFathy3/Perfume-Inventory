import fs from 'node:fs'
import path from 'node:path'

export interface ConfigData {
  dbPath: string
  /** النسخ الاحتياطي التلقائي (مرة كل يوم) */
  autoBackupEnabled: boolean
  /** فولدر النسخ التلقائية. الفاضي = الفولدر الافتراضي جوه بيانات التطبيق */
  autoBackupDir: string
  /** عدد النسخ التلقائية اللي بتتحفظ (الأقدم بيتمسح) */
  autoBackupKeep: number
}

export interface AppConfig {
  read: () => ConfigData
  write: (patch: Partial<ConfigData>) => void
}

/**
 * config.json: ملف صغير بيحفظ إعدادات الجهاز ده (مينفعش تتخزن جوه الداتا بيز نفسها):
 * مسار الداتا بيز وإعدادات النسخ التلقائي.
 */
export function createConfig(userDataDir: string, dbFileName: string): AppConfig {
  const file = path.join(userDataDir, 'config.json')
  const defaults: ConfigData = { dbPath: path.join(userDataDir, dbFileName), autoBackupEnabled: true, autoBackupDir: '', autoBackupKeep: 30 }

  function read(): ConfigData {
    try {
      return { ...defaults, ...(JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<ConfigData>) }
    } catch {
      return { ...defaults }
    }
  }

  function write(patch: Partial<ConfigData>): void {
    fs.mkdirSync(userDataDir, { recursive: true })
    fs.writeFileSync(file, JSON.stringify({ ...read(), ...patch }, null, 2))
  }

  return { read, write }
}
