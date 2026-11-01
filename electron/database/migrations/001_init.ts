import type { Migration } from '../migrate'

/** الهيكل الأساسي: الأصناف والمنتجات والمخزون والعملاء والفواتير والمرتجعات والإعدادات. */
const migration: Migration = {
  id: '001_init',
  sql: `CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL
);

CREATE TABLE items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  name_ar TEXT NOT NULL,
  name_en TEXT,
  search_text TEXT NOT NULL DEFAULT '',
  deleted_at TEXT                          -- مؤرشف (اتحذف وله حركات)
);

CREATE TABLE item_stock (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  condition TEXT NOT NULL CHECK (condition IN ('new','damaged')),
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  purchase_price REAL NOT NULL DEFAULT 0,  -- متوسط التكلفة
  selling_price REAL NOT NULL DEFAULT 0,
  wholesale_price REAL NOT NULL DEFAULT 0,
  UNIQUE (item_id, condition)
);

CREATE TABLE customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT
);

CREATE TABLE purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_name TEXT NOT NULL,
  purchase_date TEXT NOT NULL,
  shipping_cost REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  notes TEXT
);

CREATE TABLE purchase_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  item_id INTEGER NOT NULL REFERENCES items(id),
  category_id INTEGER NOT NULL REFERENCES categories(id),
  condition TEXT NOT NULL CHECK (condition IN ('new','damaged')),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  purchase_price REAL NOT NULL,
  landed_cost REAL NOT NULL,               -- سعر الشراء + نصيب الشحن
  selling_price REAL NOT NULL DEFAULT 0,
  wholesale_price REAL NOT NULL DEFAULT 0
);

CREATE TABLE sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER REFERENCES customers(id),
  sale_date TEXT NOT NULL,
  price_type TEXT NOT NULL DEFAULT 'retail' CHECK (price_type IN ('retail','wholesale')),
  shipping_payer TEXT NOT NULL DEFAULT 'customer' CHECK (shipping_payer IN ('customer','shop')),
  shipping_cost REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  notes TEXT
);

CREATE TABLE sale_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  item_id INTEGER NOT NULL REFERENCES items(id),
  category_id INTEGER NOT NULL REFERENCES categories(id),
  condition TEXT NOT NULL CHECK (condition IN ('new','damaged')),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  purchase_price REAL NOT NULL,            -- التكلفة وقت البيع
  selling_price REAL NOT NULL
);

CREATE TABLE sale_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  amount REAL NOT NULL CHECK (amount > 0),
  payment_date TEXT NOT NULL,
  notes TEXT
);

CREATE TABLE returns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK (type IN ('sale','purchase')),
  sale_id INTEGER REFERENCES sales(id),
  purchase_id INTEGER REFERENCES purchases(id),
  return_date TEXT NOT NULL,
  reason TEXT,
  total REAL NOT NULL DEFAULT 0,
  CHECK (
    (type = 'sale' AND sale_id IS NOT NULL AND purchase_id IS NULL) OR
    (type = 'purchase' AND purchase_id IS NOT NULL AND sale_id IS NULL)
  )
);

CREATE TABLE return_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  return_id INTEGER NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
  item_id INTEGER NOT NULL REFERENCES items(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price REAL NOT NULL,
  condition TEXT NOT NULL CHECK (condition IN ('new','damaged'))
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE data_transfers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK (type IN ('export','import')),
  file_path TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE INDEX idx_items_category ON items(category_id);
CREATE INDEX idx_purchase_items_purchase ON purchase_items(purchase_id);
CREATE INDEX idx_sales_customer ON sales(customer_id);
CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX idx_sale_payments_sale ON sale_payments(sale_id);
CREATE INDEX idx_return_items_return ON return_items(return_id);
`
}

export default migration
