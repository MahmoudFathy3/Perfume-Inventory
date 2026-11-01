import fs from 'node:fs'
import type { Db } from './connection'
import m001 from './migrations/001_init'
import m002 from './migrations/002_workspaces'
import m003 from './migrations/003_transfers'
import m004 from './migrations/004_sale_partner'

/** migration = SQL ثابت (sql) أو كود بيشغّله على الداتا بيز (up) لما محتاجين شرط أو حساب */
export interface Migration {
  id: string
  sql?: string
  up?: (db: Db) => void
}

/** كل migration في ملف لوحده في migrations/. ضيف الجديد هنا بالترتيب. متعدّلش migration اتنفّذت قبل كده: اعمل واحدة جديدة. */
const migrations: Migration[] = [m001, m002, m003, m004]

/** نسخة احتياطية من ملف الداتا بيز قبل أي تحويل على داتا موجودة */
function backupBeforeMigration(db: Db, firstId: string): void {
  if (!db.name || db.name === ':memory:' || !fs.existsSync(db.name)) return
  fs.copyFileSync(db.name, `${db.name}.before-${firstId}.bak`)
}

export function migrate(db: Db): void {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY)')
  const rows = db.prepare('SELECT id FROM schema_migrations').all() as { id: string }[]
  const done = new Set(rows.map((r) => r.id))
  const pending = migrations.filter((m) => !done.has(m.id))
  if (pending.length === 0) return
  if (done.size > 0) backupBeforeMigration(db, pending[0].id)

  for (const m of pending) {
    db.transaction(() => {
      if (m.sql) db.exec(m.sql)
      m.up?.(db)
      db.prepare('INSERT INTO schema_migrations(id) VALUES (?)').run(m.id)
    })()
  }
}
