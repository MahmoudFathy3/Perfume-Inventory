import type { Migration } from '../migrate'

/** التحويل بين المخزون الفعلي والشراكات + تسويات الشركاء */
const migration: Migration = {
  id: '003_transfers',
  sql: `
-- التحويل بين المخزون الفعلي وأي شراكة (في الاتجاهين).
-- kind: capital = رأس مال من شريك | sale = بيع للطرف التاني بسعر محدد | half = نقل بالنص من غير حسابات
CREATE TABLE IF NOT EXISTS transfers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_workspace_id INTEGER NOT NULL REFERENCES workspaces(id),
  to_workspace_id INTEGER NOT NULL REFERENCES workspaces(id),
  kind TEXT NOT NULL CHECK (kind IN ('capital','sale','half')),
  partner_id INTEGER REFERENCES workspace_partners(id),
  transfer_date TEXT NOT NULL,
  total_cost REAL NOT NULL DEFAULT 0,      -- بتكلفة المصدر
  total_price REAL NOT NULL DEFAULT 0,     -- بسعر التحويل (= التكلفة إلا في kind = sale)
  notes TEXT,
  CHECK (from_workspace_id != to_workspace_id),
  CHECK (kind = 'half' OR partner_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS transfer_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transfer_id INTEGER NOT NULL REFERENCES transfers(id) ON DELETE CASCADE,
  from_item_id INTEGER NOT NULL REFERENCES items(id),
  to_item_id INTEGER NOT NULL REFERENCES items(id),
  condition TEXT NOT NULL CHECK (condition IN ('new','damaged')),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_cost REAL NOT NULL,                 -- تكلفة القطعة في المصدر
  unit_price REAL NOT NULL                 -- تكلفتها في الوجهة
);

-- تسويات الشركاء: موجب = الشراكة دفعت للشريك، سالب = الشريك دفع للشراكة
CREATE TABLE IF NOT EXISTS partner_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id),
  partner_id INTEGER NOT NULL REFERENCES workspace_partners(id),
  amount REAL NOT NULL CHECK (amount != 0),
  payment_date TEXT NOT NULL,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_transfers_from ON transfers(from_workspace_id);
CREATE INDEX IF NOT EXISTS idx_transfers_to ON transfers(to_workspace_id);
CREATE INDEX IF NOT EXISTS idx_transfer_items_transfer ON transfer_items(transfer_id);
CREATE INDEX IF NOT EXISTS idx_partner_payments_workspace ON partner_payments(workspace_id);
`
}

export default migration
