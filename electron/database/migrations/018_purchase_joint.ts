import type { Migration } from '../migrate'

/**
 * فاتورة شراء الشريكين مع بعض (في الشراكة): joint = 1 و partner_id = NULL.
 * لو دفعوها من جيبهم (paid_by_partner = 1) كل شريك بيتحسب له نصيبه منها بنسبته في الشراكة.
 */
const migration: Migration = {
  id: '018_purchase_joint',
  sql: `ALTER TABLE purchases ADD COLUMN joint INTEGER NOT NULL DEFAULT 0 CHECK (joint IN (0, 1));`
}

export default migration
