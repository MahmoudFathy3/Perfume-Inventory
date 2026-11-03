import type { Migration } from '../migrate'

/** فاتورة شراء في الشراكة دفعها الشريك من جيبه: الشراكة بتبقى عليها إجماليها له (بعد مرتجعات الشراء) */
const migration: Migration = {
  id: '014_purchase_paid_by_partner',
  sql: `
ALTER TABLE purchases ADD COLUMN paid_by_partner INTEGER NOT NULL DEFAULT 0;
`
}

export default migration
