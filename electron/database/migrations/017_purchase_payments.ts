import type { Migration } from '../migrate'

/**
 * دفعات فواتير الشراء للمورد (زي دفعات البيع): المتبقي للمورد = الإجمالي − المرتجع − المدفوع.
 * الفواتير القديمة كانت بتتعامل كأنها اتدفعت كاش كلها يوم الفاتورة، فبتتسجل لها دفعة بالإجمالي.
 * اللي الشريك دفعها من جيبه (paid_by_partner) ملهاش دفعات: الشريك دفعها كلها، والشراكة مدينة له مش للمورد.
 */
const migration: Migration = {
  id: '017_purchase_payments',
  sql: `
CREATE TABLE IF NOT EXISTS purchase_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  amount REAL NOT NULL CHECK (amount > 0),
  payment_date TEXT NOT NULL,
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_purchase_payments_purchase ON purchase_payments(purchase_id);

INSERT INTO purchase_payments(purchase_id, amount, payment_date)
SELECT id, total, purchase_date FROM purchases WHERE paid_by_partner = 0 AND total > 0;
`
}

export default migration
