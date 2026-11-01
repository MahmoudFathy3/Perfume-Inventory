import type { Db } from '../connection'
import type { Migration } from '../migrate'

/** الجداول اللي بيانات التشغيل بتتبع مساحة فيها (الباقي بيتبع أبوه) */
const SCOPED_TABLES = ['categories', 'items', 'customers', 'purchases', 'sales', 'returns']

/**
 * المخازن والشراكات: المخزون الفعلي (id = 1) + الشراكات.
 * أي بيانات موجودة قبل المرحلة دي بتفضل زي ما هي وبتتبع المخزون الفعلي (DEFAULT 1).
 * بتتخطى لو الجداول موجودة (داتا بيز اتعملت بنسخة وسيطة كان الهيكل ده جوه 001).
 */
const migration: Migration = {
  id: '002_workspaces',
  up(db: Db) {
    if (db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'workspaces'").get()) return

    db.exec(`
CREATE TABLE workspaces (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL CHECK (kind IN ('personal','partnership')),
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  closed_at TEXT                           -- الشراكة المقفولة مبتظهرش في التبديل
);
INSERT INTO workspaces(id, kind, name) VALUES (1, 'personal', 'personal');

CREATE TABLE workspace_partners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  share_percent REAL NOT NULL DEFAULT 50
);`)

    // SQLite مبيسمحش بإضافة عمود NOT NULL له REFERENCES، فالعمود من غير FK (الفلترة بالمساحة بتتم في كل استعلام)
    for (const table of SCOPED_TABLES) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN workspace_id INTEGER NOT NULL DEFAULT 1`)
      db.exec(`CREATE INDEX idx_${table}_workspace ON ${table}(workspace_id)`)
    }
  }
}

export default migration
