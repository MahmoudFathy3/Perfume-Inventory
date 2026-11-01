import assert from 'node:assert/strict'
import test from 'node:test'
import { createDatabase, getDb } from '../database/connection'
import m001 from '../database/migrations/001_init'
import { migrate } from '../database/migrate'
import { useTestDb } from './helpers'

useTestDb()

test('الداتا بيز: الهيكل كامل والـ migration مرتين مبتأذيش', () => {
  migrate(getDb())
  const tables = (getDb().prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]).map((r) => r.name)
  for (const t of ['categories', 'items', 'item_stock', 'customers', 'purchases', 'purchase_items', 'sales', 'sale_items', 'sale_payments', 'workspaces', 'workspace_partners', 'returns', 'return_items', 'settings']) {
    assert.ok(tables.includes(t), t)
  }
  assert.ok(!tables.includes('sub_categories'))
  assert.deepEqual((getDb().prepare('SELECT id FROM schema_migrations').all() as { id: string }[]).map((r) => r.id), ['001_init', '002_workspaces', '003_transfers'])
})

test('الـ migration على داتا بيز قديمة (قبل المخازن): البيانات بتفضل وبتتبع المخزون الفعلي', () => {
  const db = createDatabase(':memory:')
  db.exec('CREATE TABLE schema_migrations (id TEXT PRIMARY KEY)')
  db.exec(m001.sql!)
  db.prepare("INSERT INTO schema_migrations(id) VALUES ('001_init')").run()
  db.exec("INSERT INTO categories(name) VALUES ('دخوني'); INSERT INTO items(category_id, name_ar) VALUES (1, 'خليفه'); INSERT INTO customers(name) VALUES ('سامي')")

  migrate(db)
  assert.deepEqual((db.prepare('SELECT id FROM schema_migrations ORDER BY id').all() as { id: string }[]).map((r) => r.id), ['001_init', '002_workspaces', '003_transfers'])
  for (const table of ['categories', 'items', 'customers']) {
    assert.deepEqual(db.prepare(`SELECT workspace_id FROM ${table}`).all(), [{ workspace_id: 1 }], table)
  }
  assert.deepEqual(db.prepare('SELECT id, kind FROM workspaces').all(), [{ id: 1, kind: 'personal' }])
  db.close()
})
