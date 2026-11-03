import type { Migration } from '../migrate'

/**
 * دفعات التحويلات (بيع بسعر): الدفعة بتتسجل تسوية شريك (partner_payments) مربوطة بالتحويل،
 * فحسابات الشركاء بتفضل صح من غير ما الفلوس تتحسب مرتين. الدفعات القديمة transfer_id = NULL.
 */
const migration: Migration = {
  id: '008_transfer_payments',
  sql: `
ALTER TABLE partner_payments ADD COLUMN transfer_id INTEGER REFERENCES transfers(id);
CREATE INDEX IF NOT EXISTS idx_partner_payments_transfer ON partner_payments(transfer_id);
`
}

export default migration
