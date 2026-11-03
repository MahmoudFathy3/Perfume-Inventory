import type { Migration } from '../migrate'

/** تكلفة منتجات المخزن الخارجي للقطعة الواحدة (بالريال): السعر اللي اتدفع + الشحن + الجمارك */
const migration: Migration = {
  id: '007_warehouse_costs',
  sql: `
ALTER TABLE warehouse_items ADD COLUMN unit_price REAL NOT NULL DEFAULT 0;
ALTER TABLE warehouse_items ADD COLUMN shipping REAL NOT NULL DEFAULT 0;
ALTER TABLE warehouse_items ADD COLUMN customs REAL NOT NULL DEFAULT 0;
`
}

export default migration
