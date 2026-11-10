import type { Migration } from '../migrate'

/**
 * المصروفات (إيجار، رواتب، كهرباء...) لكل مخزن.
 * category = النوع اللي المستخدم كتبه | deduct = 1 بيتخصم من الربح، 0 تسجيل بس.
 */
const migration: Migration = {
  id: '016_expenses',
  sql: `
CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id),
  expense_date TEXT NOT NULL,
  category TEXT NOT NULL,
  amount REAL NOT NULL CHECK (amount > 0),
  deduct INTEGER NOT NULL DEFAULT 1 CHECK (deduct IN (0, 1)),
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_expenses_workspace_date ON expenses(workspace_id, expense_date);
`
}

export default migration
