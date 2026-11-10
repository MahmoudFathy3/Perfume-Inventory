import type { Migration } from '../migrate'

/**
 * فلوس العميل اللي بتطلع من فاتورة:
 * - cash: اترد له كاش مع مرتجع (return_id).
 * - credit: رصيده (اللي دفعه زيادة بعد مرتجع) اتخصم في فاتورة تانية، والدفعة اللي اتعملت هناك هي payment_id.
 * المدفوع الفعلي على الفاتورة = الدفعات − الردود. sale_payments.from_credit = الدفعة من رصيد العميل (مش فلوس جديدة اتحصّلت).
 */
const migration: Migration = {
  id: '013_sale_refunds',
  sql: `
CREATE TABLE IF NOT EXISTS sale_refunds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  amount REAL NOT NULL CHECK (amount > 0),
  refund_date TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('cash','credit')),
  return_id INTEGER REFERENCES returns(id) ON DELETE CASCADE,
  payment_id INTEGER REFERENCES sale_payments(id) ON DELETE CASCADE,
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_sale_refunds_sale ON sale_refunds(sale_id);
ALTER TABLE sale_payments ADD COLUMN from_credit INTEGER NOT NULL DEFAULT 0;
`
}

export default migration
