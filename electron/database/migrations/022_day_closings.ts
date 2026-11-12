import type { Migration } from '../migrate'

/**
 * التقفيل اليومي (المخزون الفعلي والشراكات): اليوم المقفول بيتحفظ بتقريره وقت التقفيل (report = JSON:
 * الإجماليات وكل شريك عمل إيه)، وأي فاتورة / دفعة / مصروف / تحويل / تسوية بتاريخ اليوم ده مبتتعدّلش لحد ما يتفتح تاني.
 */
const migration: Migration = {
  id: '022_day_closings',
  sql: `
CREATE TABLE IF NOT EXISTS day_closings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id),
  day TEXT NOT NULL,                      -- YYYY-MM-DD
  closed_at TEXT NOT NULL,
  notes TEXT,
  report TEXT NOT NULL,                   -- تقرير اليوم وقت التقفيل (JSON)
  UNIQUE (workspace_id, day)
);
`
}

export default migration
