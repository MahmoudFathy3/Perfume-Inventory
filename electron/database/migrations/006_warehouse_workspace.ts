import type { Db } from '../connection'
import type { Migration } from '../migrate'

/**
 * مخزن السعودية بقى مخزن لوحده في التبديل (kind = warehouse) زي المخزون الفعلي والشراكات.
 * - جدول workspaces بيتبني من جديد علشان الـ CHECK يقبل النوع الجديد (SQLite مبيعدّلش CHECK).
 * - منتجات وشحنات مخزن السعودية بقت تبع مخزن معيّن (warehouse_id).
 * - لو كان فيه بيانات متسجلة قبل كده بيتعمل لها مخزن اسمه "مخزن السعودية".
 */
const migration: Migration = {
  id: '006_warehouse_workspace',
  foreignKeysOff: true,
  up(db: Db) {
    db.exec(`
CREATE TABLE workspaces_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL CHECK (kind IN ('personal','partnership','warehouse')),
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  closed_at TEXT
);
INSERT INTO workspaces_new(id, kind, name, created_at, closed_at) SELECT id, kind, name, created_at, closed_at FROM workspaces;
DROP TABLE workspaces;
ALTER TABLE workspaces_new RENAME TO workspaces;

ALTER TABLE warehouse_items ADD COLUMN warehouse_id INTEGER REFERENCES workspaces(id);
ALTER TABLE warehouse_shipments ADD COLUMN warehouse_id INTEGER REFERENCES workspaces(id);
CREATE INDEX idx_warehouse_items_warehouse ON warehouse_items(warehouse_id);
CREATE INDEX idx_warehouse_shipments_warehouse ON warehouse_shipments(warehouse_id);`)

    const hasData = db.prepare('SELECT 1 FROM warehouse_items UNION ALL SELECT 1 FROM warehouse_shipments LIMIT 1').get()
    if (!hasData) return
    const id = db.prepare("INSERT INTO workspaces(kind, name) VALUES ('warehouse', 'مخزن السعودية')").run().lastInsertRowid
    db.prepare('UPDATE warehouse_items SET warehouse_id = ?').run(id)
    db.prepare('UPDATE warehouse_shipments SET warehouse_id = ?').run(id)
  }
}

export default migration
