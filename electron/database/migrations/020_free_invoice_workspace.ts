import type { Migration } from '../migrate'

/**
 * الفواتير الحرّة في أي مخزن (المخزون الفعلي والشراكات): كل فاتورة تبع مخزنها (القديمة كانت في المخزون الفعلي).
 * وكل بند ليه حالة (جديد / تالف) حتى البنود اللي من برّه.
 */
const migration: Migration = {
  id: '020_free_invoice_workspace',
  sql: `
ALTER TABLE free_invoices ADD COLUMN workspace_id INTEGER NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS idx_free_invoices_workspace ON free_invoices(workspace_id);
UPDATE free_invoice_items SET condition = 'new' WHERE condition IS NULL;
`
}

export default migration
