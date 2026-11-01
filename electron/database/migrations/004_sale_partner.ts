import type { Migration } from '../migrate'

/** الشريك اللي عمل فاتورة البيع (في الشراكات بس، والمخزون الفعلي بيفضل NULL) */
const migration: Migration = {
  id: '004_sale_partner',
  sql: `
ALTER TABLE sales ADD COLUMN partner_id INTEGER REFERENCES workspace_partners(id);
CREATE INDEX IF NOT EXISTS idx_sales_partner ON sales(partner_id);
`
}

export default migration
