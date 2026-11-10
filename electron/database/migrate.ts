import fs from 'node:fs'
import type { Db } from './connection'
import m001 from './migrations/001_init'
import m002 from './migrations/002_workspaces'
import m003 from './migrations/003_transfers'
import m004 from './migrations/004_sale_partner'
import m005 from './migrations/005_warehouse'
import m006 from './migrations/006_warehouse_workspace'
import m007 from './migrations/007_warehouse_costs'
import m008 from './migrations/008_transfer_payments'
import m009 from './migrations/009_partner_customer'
import m010 from './migrations/010_mixed_sales'
import m011 from './migrations/011_transfer_recipient'
import m012 from './migrations/012_purchase_partner'
import m013 from './migrations/013_sale_refunds'
import m014 from './migrations/014_purchase_paid_by_partner'
import m015 from './migrations/015_partner_pair_payments'
import m016 from './migrations/016_expenses'
import m017 from './migrations/017_purchase_payments'
import m018 from './migrations/018_purchase_joint'
import m019 from './migrations/019_free_invoices'
import m020 from './migrations/020_free_invoice_workspace'
/** migration = SQL ثابت (sql) أو كود بيشغّله على الداتا بيز (up) لما محتاجين شرط أو حساب */
export interface Migration {
  id: string
  sql?: string
  up?: (db: Db) => void
  /** إعادة بناء جدول عليه references: الـ foreign keys بتتقفل أثناءها وبنتأكد إن مفيش حاجة باظت قبل الـ commit */
  foreignKeysOff?: boolean
}

/** كل migration في ملف لوحده في migrations/. ضيف الجديد هنا بالترتيب. متعدّلش migration اتنفّذت قبل كده: اعمل واحدة جديدة. */
const migrations: Migration[] = [m001, m002, m003, m004, m005, m006, m007, m008, m009, m010, m011, m012, m013, m014, m015, m016, m017, m018, m019, m020]

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
    // الـ pragma ده مبيتغيرش جوه transaction، فبيتقفل قبلها ويرجع بعدها
    if (m.foreignKeysOff) db.pragma('foreign_keys = OFF')
    try {
      db.transaction(() => {
        if (m.sql) db.exec(m.sql)
        m.up?.(db)
        if (m.foreignKeysOff && (db.pragma('foreign_key_check') as unknown[]).length > 0) throw new Error(`${m.id}: foreign key check failed`)
        db.prepare('INSERT INTO schema_migrations(id) VALUES (?)').run(m.id)
      })()
    } finally {
      if (m.foreignKeysOff) db.pragma('foreign_keys = ON')
    }
  }
}
