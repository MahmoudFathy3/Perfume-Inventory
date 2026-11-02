import type { Migration } from '../migrate'

/**
 * مخزن السعودية: كميات وشحنات بس (من غير أسعار، ومن غير ما البضاعة تتنقل لمخازن مصر).
 * لما الشحنة توصل بتتسجل فاتورة شراء عادي في المخزن اللي استلمها.
 */
const migration: Migration = {
  id: '005_warehouse',
  sql: `
CREATE TABLE IF NOT EXISTS warehouse_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  notes TEXT
);

-- workspace_id = المخزن اللي الشحنة رايحاله في مصر (الفعلي أو شراكة)
CREATE TABLE IF NOT EXISTS warehouse_shipments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ship_date TEXT NOT NULL,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id),
  status TEXT NOT NULL DEFAULT 'in_transit' CHECK (status IN ('in_transit','arrived')),
  arrived_date TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS warehouse_shipment_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shipment_id INTEGER NOT NULL REFERENCES warehouse_shipments(id) ON DELETE CASCADE,
  item_id INTEGER NOT NULL REFERENCES warehouse_items(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0)
);

CREATE INDEX IF NOT EXISTS idx_warehouse_shipment_items_shipment ON warehouse_shipment_items(shipment_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_shipment_items_item ON warehouse_shipment_items(item_id);
`
}

export default migration
