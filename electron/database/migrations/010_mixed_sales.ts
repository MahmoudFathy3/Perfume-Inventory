import type { Migration } from '../migrate'

/**
 * فاتورة بيع واحدة فيها منتجات من مخزن تاني (المخزون الفعلي ↔ شراكة):
 * - transfers.sale_id: التحويل التلقائي (بيع بسعر) اللي اتعمل للفاتورة دي.
 * - sale_items.source_*: السطر جاي من أنهي مخزن ومنتج، وبسعر تحويل كام.
 * - return_items.to_source: المرتجع رجع للمخزن الأصلي بدل مخزن الفاتورة.
 * - transfer_items.returned_quantity: القطع اللي رجعت للمصدر من التحويل ده (من مرتجع).
 */
const migration: Migration = {
  id: '010_mixed_sales',
  sql: `
ALTER TABLE transfers ADD COLUMN sale_id INTEGER REFERENCES sales(id);
CREATE INDEX IF NOT EXISTS idx_transfers_sale ON transfers(sale_id);
ALTER TABLE transfer_items ADD COLUMN returned_quantity INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sale_items ADD COLUMN source_workspace_id INTEGER REFERENCES workspaces(id);
ALTER TABLE sale_items ADD COLUMN source_item_id INTEGER REFERENCES items(id);
ALTER TABLE sale_items ADD COLUMN transfer_price REAL;
ALTER TABLE return_items ADD COLUMN to_source INTEGER NOT NULL DEFAULT 0;
`
}

export default migration
