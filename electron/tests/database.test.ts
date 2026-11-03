import assert from 'node:assert/strict'
import test from 'node:test'
import { createDatabase, getDb } from '../database/connection'
import m001 from '../database/migrations/001_init'
import m002 from '../database/migrations/002_workspaces'
import m003 from '../database/migrations/003_transfers'
import m004 from '../database/migrations/004_sale_partner'
import m005 from '../database/migrations/005_warehouse'
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
  assert.deepEqual((getDb().prepare('SELECT id FROM schema_migrations').all() as { id: string }[]).map((r) => r.id), ['001_init', '002_workspaces', '003_transfers', '004_sale_partner', '005_warehouse', '006_warehouse_workspace', '007_warehouse_costs', '008_transfer_payments', '009_partner_customer', '010_mixed_sales', '011_transfer_recipient', '012_purchase_partner', '013_sale_refunds', '014_purchase_paid_by_partner', '015_partner_pair_payments', '016_expenses', '017_purchase_payments', '018_purchase_joint'])
})

test('الـ migration على داتا بيز قديمة (قبل المخازن): البيانات بتفضل وبتتبع المخزون الفعلي', () => {
  const db = createDatabase(':memory:')
  db.exec('CREATE TABLE schema_migrations (id TEXT PRIMARY KEY)')
  db.exec(m001.sql!)
  db.prepare("INSERT INTO schema_migrations(id) VALUES ('001_init')").run()
  db.exec("INSERT INTO categories(name) VALUES ('دخوني'); INSERT INTO items(category_id, name_ar) VALUES (1, 'خليفه'); INSERT INTO customers(name) VALUES ('سامي')")

  migrate(db)
  assert.deepEqual((db.prepare('SELECT id FROM schema_migrations ORDER BY id').all() as { id: string }[]).map((r) => r.id), ['001_init', '002_workspaces', '003_transfers', '004_sale_partner', '005_warehouse', '006_warehouse_workspace', '007_warehouse_costs', '008_transfer_payments', '009_partner_customer', '010_mixed_sales', '011_transfer_recipient', '012_purchase_partner', '013_sale_refunds', '014_purchase_paid_by_partner', '015_partner_pair_payments', '016_expenses', '017_purchase_payments', '018_purchase_joint'])
  for (const table of ['categories', 'items', 'customers']) {
    assert.deepEqual(db.prepare(`SELECT workspace_id FROM ${table}`).all(), [{ workspace_id: 1 }], table)
  }
  assert.deepEqual(db.prepare('SELECT id, kind FROM workspaces').all(), [{ id: 1, kind: 'personal' }])
  db.close()
})

test('006: جدول المخازن بيتبني من جديد من غير ما الروابط تبوظ، وبيانات مخزن السعودية القديمة بتروح لمخزن خارجي جديد', () => {
  const db = createDatabase(':memory:')
  db.exec('CREATE TABLE schema_migrations (id TEXT PRIMARY KEY)')
  for (const m of [m001, m002, m003, m004, m005]) {
    if (m.sql) db.exec(m.sql)
    m.up?.(db)
    db.prepare('INSERT INTO schema_migrations(id) VALUES (?)').run(m.id)
  }
  db.exec(`INSERT INTO workspaces(kind, name) VALUES ('partnership', '');
           INSERT INTO workspace_partners(workspace_id, name) VALUES (2, 'محمود');
           INSERT INTO warehouse_items(name, quantity) VALUES ('خليفه', 5);
           INSERT INTO warehouse_shipments(ship_date, workspace_id) VALUES ('2026-01-01', 2);
           INSERT INTO warehouse_shipment_items(shipment_id, item_id, quantity) VALUES (1, 1, 2)`)

  migrate(db)
  assert.deepEqual(db.prepare('SELECT id, kind, name FROM workspaces ORDER BY id').all(), [
    { id: 1, kind: 'personal', name: 'personal' },
    { id: 2, kind: 'partnership', name: '' },
    { id: 3, kind: 'warehouse', name: 'مخزن السعودية' }
  ])
  assert.deepEqual(db.prepare('SELECT warehouse_id FROM warehouse_items').all(), [{ warehouse_id: 3 }])
  assert.deepEqual(db.prepare('SELECT warehouse_id, workspace_id FROM warehouse_shipments').all(), [{ warehouse_id: 3, workspace_id: 2 }])
  assert.equal(db.pragma('foreign_keys', { simple: true }), 1) // رجعت تشتغل بعد الـ migration
  assert.deepEqual(db.pragma('foreign_key_check'), [])
  // الروابط لسه شغالة على الجدول الجديد
  assert.throws(() => db.prepare('DELETE FROM workspaces WHERE id = 2').run(), /FOREIGN KEY/)
  db.close()
})
