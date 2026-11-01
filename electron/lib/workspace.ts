import { getDb, queryOne, execute } from '../database/connection'
import type { SearchClause } from './search'

/** المخزون الفعلي: موجود دايمًا ومينفعش يتحذف أو يتقفل */
export const PERSONAL_WORKSPACE_ID = 1
const ACTIVE_KEY = 'active_workspace_id'

let cache: { db: unknown; id: number } | null = null

/** المساحة اللي شغالين عليها. بتتحفظ في الإعدادات، وبترجع للمخزون الفعلي لو المحفوظة اتقفلت أو اتمسحت. */
export function activeWorkspaceId(): number {
  const db = getDb()
  if (cache?.db === db) return cache.id
  const saved = Number(queryOne<{ value: string }>('SELECT value FROM settings WHERE key = ?', [ACTIVE_KEY])?.value)
  const open = saved ? queryOne('SELECT 1 FROM workspaces WHERE id = ? AND closed_at IS NULL', [saved]) : undefined
  cache = { db, id: open ? saved : PERSONAL_WORKSPACE_ID }
  return cache.id
}

export function setActiveWorkspaceId(id: number): void {
  const db = getDb()
  execute('INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [ACTIVE_KEY, String(id)])
  cache = { db, id }
}

/** شغّل دالة (متزامنة) على مساحة معينة وارجع للمساحة النشطة بعدها. بنستخدمها لتجميع أرقام كل المخازن. */
export function withWorkspace<T>(id: number, fn: () => T): T {
  const previous = activeWorkspaceId()
  cache = { db: getDb(), id }
  try {
    return fn()
  } finally {
    cache = { db: getDb(), id: previous }
  }
}

/** شرط SQL يحصر العمود في المساحة النشطة. القيمة رقم داخلي (مش مدخل من المستخدم). */
export const inWorkspace = (column: string): string => `${column} = ${activeWorkspaceId()}`

/** بيضيف شرط المساحة لشرط البحث: WHERE ws AND (بحث) */
export function scoped(column: string, search: SearchClause, prefix: 'WHERE' | 'AND' = 'WHERE'): SearchClause {
  const term = search.where.replace(/^(WHERE|AND)\s*/, '')
  return { where: `${prefix} ${inWorkspace(column)}${term ? ` AND ${term}` : ''}`, params: search.params }
}
