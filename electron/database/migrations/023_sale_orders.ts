import type { Migration } from '../migrate'

/**
 * فواتير "تحت التجهيز" (طلبات لسه ما اتباعتش): مبتخصمش من المخزون ومش داخلة في المبيعات ولا الربح ولا حساب العميل.
 * القطع اللي فيها بتظهر "محجوزة" في منتجاتها (item_id = المنتج في المخزن اللي القطع فيه، حتى لو مخزن تاني).
 * deposit = العربون اللي العميل دفعه (بيتحسب دفعة من الفاتورة لما تتباع).
 * لما تتباع بتتحول لفاتورة بيع عادية والطلب بيتمسح.
 */
const migration: Migration = {
  id: '023_sale_orders',
  sql: `
CREATE TABLE IF NOT EXISTS sale_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id),
  order_date TEXT NOT NULL,
  customer_id INTEGER REFERENCES customers(id),
  partner_id INTEGER REFERENCES workspace_partners(id),
  price_type TEXT NOT NULL DEFAULT 'retail' CHECK (price_type IN ('retail','wholesale')),
  shipping_payer TEXT NOT NULL DEFAULT 'customer' CHECK (shipping_payer IN ('customer','shop')),
  shipping_cost REAL NOT NULL DEFAULT 0 CHECK (shipping_cost >= 0),
  total REAL NOT NULL DEFAULT 0,
  deposit REAL NOT NULL DEFAULT 0 CHECK (deposit >= 0),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS sale_order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES sale_orders(id) ON DELETE CASCADE,
  item_id INTEGER NOT NULL REFERENCES items(id),
  condition TEXT NOT NULL CHECK (condition IN ('new','damaged')),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  selling_price REAL NOT NULL CHECK (selling_price >= 0),
  source_workspace_id INTEGER REFERENCES workspaces(id),  -- القطعة من مخزن تاني (بتتحوّل لما الطلب يتباع)
  transfer_price REAL
);

CREATE INDEX IF NOT EXISTS idx_sale_orders_workspace ON sale_orders(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sale_order_items_order ON sale_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_sale_order_items_item ON sale_order_items(item_id, condition);
`
}

export default migration
