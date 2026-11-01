import type { Category, Page, PageParams } from '@shared/types'
import { execute, queryAll, queryOne } from '../../database/connection'
import { queryPage } from '../../lib/pagination'
import { searchClause } from '../../lib/search'
import { activeWorkspaceId, inWorkspace, scoped } from '../../lib/workspace'

type ListOptions = { search?: string }

function listQuery(opts: ListOptions) {
  const { where, params } = scoped('c.workspace_id', searchClause(['c.name'], opts.search))
  const sql = `SELECT c.id, c.name,
            (SELECT COUNT(*) FROM items i WHERE i.category_id = c.id AND i.deleted_at IS NULL) AS items_count
     FROM categories c ${where} ORDER BY c.name`
  return { sql, params }
}

/** كل الأصناف (للقوايم المنسدلة والتصدير) */
export function findAll(opts: ListOptions = {}): Category[] {
  const { sql, params } = listQuery(opts)
  return queryAll<Category>(sql, params)
}

/** صفحة واحدة من الأصناف */
export function findPage(opts: ListOptions, page: PageParams): Page<Category> {
  const { sql, params } = listQuery(opts)
  return queryPage<Category>(sql, params, page)
}

/** صنف بنفس الاسم (من غير تفرقة همزة/تاء مربوطة)، مع استثناء الصنف نفسه وقت التعديل */
export const findByName = (name: string, excludeId = 0) =>
  queryOne<{ id: number }>(`SELECT id FROM categories WHERE ${inWorkspace('workspace_id')} AND norm(name) = norm(?) AND id != ?`, [name, excludeId])
export const insert = (name: string) => execute('INSERT INTO categories(workspace_id, name) VALUES (?, ?)', [activeWorkspaceId(), name])
export const update = (id: number, name: string) =>
  void execute(`UPDATE categories SET name = ? WHERE id = ? AND ${inWorkspace('workspace_id')}`, [name, id])
export const remove = (id: number) => void execute(`DELETE FROM categories WHERE id = ? AND ${inWorkspace('workspace_id')}`, [id])
