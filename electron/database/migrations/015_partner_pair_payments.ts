import type { Migration } from '../migrate'

/**
 * تسوية بين الشريكين (واحد دفع للتاني من جيبه): بتتسجل تسويتين مربوطتين بنفس pair_id
 * (الشراكة دفعت للي استلم + اللي دفع دفع للشراكة)، بيتعرضوا سطر واحد وبيتحذفوا مع بعض.
 */
const migration: Migration = {
  id: '015_partner_pair_payments',
  sql: `
ALTER TABLE partner_payments ADD COLUMN pair_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_partner_payments_pair ON partner_payments(pair_id);
`
}

export default migration
