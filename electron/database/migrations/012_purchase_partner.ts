import type { Migration } from '../migrate'

/** الشريك اللي اشترى البضاعة في فاتورة الشراء (في الشراكات بس، والمخزون الفعلي بيفضل NULL) */
const migration: Migration = {
  id: '012_purchase_partner',
  sql: `
ALTER TABLE purchases ADD COLUMN partner_id INTEGER REFERENCES workspace_partners(id);
CREATE INDEX IF NOT EXISTS idx_purchases_partner ON purchases(partner_id);
`
}

export default migration
