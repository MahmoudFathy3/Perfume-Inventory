import type { Migration } from '../migrate'

/**
 * تقفيل الشهر في الشراكة: الشهر المقفول بيتحفظ بأرقامه وقت التقفيل (الشهر وحساب كل شريك فيه)،
 * وأي فاتورة / دفعة / مصروف / تحويل / تسوية بتاريخ في الشهر ده مبتتعدّلش لحد ما الشهر يتفتح تاني.
 */
const migration: Migration = {
  id: '021_month_closings',
  sql: `
CREATE TABLE IF NOT EXISTS month_closings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id),
  month TEXT NOT NULL,                    -- YYYY-MM
  closed_at TEXT NOT NULL,
  sales_count INTEGER NOT NULL DEFAULT 0,
  sales_total REAL NOT NULL DEFAULT 0,
  sales_returns REAL NOT NULL DEFAULT 0,
  profit REAL NOT NULL DEFAULT 0,
  expenses REAL NOT NULL DEFAULT 0,
  net_profit REAL NOT NULL DEFAULT 0,
  notes TEXT,
  UNIQUE (workspace_id, month)
);

-- حساب كل شريك في الشهر المقفول (الاسم والنسبة وقت التقفيل)
CREATE TABLE IF NOT EXISTS month_closing_partners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  closing_id INTEGER NOT NULL REFERENCES month_closings(id) ON DELETE CASCADE,
  partner_id INTEGER NOT NULL REFERENCES workspace_partners(id),
  partner_name TEXT NOT NULL,
  share_percent REAL NOT NULL,
  opening REAL NOT NULL DEFAULT 0,
  profit_share REAL NOT NULL DEFAULT 0,
  sold REAL NOT NULL DEFAULT 0,
  paid_out REAL NOT NULL DEFAULT 0,
  settled REAL NOT NULL DEFAULT 0,
  closing REAL NOT NULL DEFAULT 0,
  capital REAL NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_month_closing_partners_closing ON month_closing_partners(closing_id);
`
}

export default migration
