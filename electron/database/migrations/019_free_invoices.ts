import type { Migration } from '../migrate'

/**
 * الفواتير الحرّة (في المخزون الفعلي بس): فاتورة للعميل فيها أي بنود (من المخزون أو من برّه) علشان يشوف التوتال،
 * ملهاش أي أثر على المخزون ولا المبيعات ولا الربح ولا حسابات العملاء. ليها دفعات لوحدها (اتدفع / الباقي).
 * sale_id = فاتورة البيع اللي اتعملت من بنود المخزون فيها (لو اتحذفت الربط بيتشال).
 */
const migration: Migration = {
  id: '019_free_invoices',
  sql: `
CREATE TABLE IF NOT EXISTS free_invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_date TEXT NOT NULL,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT,                       -- لو العميل مش متسجل
  customer_phone TEXT,
  price_type TEXT NOT NULL DEFAULT 'retail' CHECK (price_type IN ('retail','wholesale')),
  shipping_cost REAL NOT NULL DEFAULT 0 CHECK (shipping_cost >= 0),
  discount REAL NOT NULL DEFAULT 0 CHECK (discount >= 0),
  total REAL NOT NULL DEFAULT 0,
  notes TEXT,
  sale_id INTEGER REFERENCES sales(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- item_id = منتج من المخزون (الاسم والحالة للعرض، ومبيتخصمش)، NULL = بند من برّه
CREATE TABLE IF NOT EXISTS free_invoice_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL REFERENCES free_invoices(id) ON DELETE CASCADE,
  item_id INTEGER REFERENCES items(id) ON DELETE SET NULL,
  condition TEXT CHECK (condition IN ('new','damaged')),
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price REAL NOT NULL CHECK (unit_price >= 0)
);

CREATE TABLE IF NOT EXISTS free_invoice_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL REFERENCES free_invoices(id) ON DELETE CASCADE,
  amount REAL NOT NULL CHECK (amount > 0),
  payment_date TEXT NOT NULL,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_free_invoice_items_invoice ON free_invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_free_invoice_payments_invoice ON free_invoice_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_free_invoices_date ON free_invoices(invoice_date);
`
}

export default migration
