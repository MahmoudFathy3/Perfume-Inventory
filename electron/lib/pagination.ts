import type { Page, PageParams } from '@shared/types'
import { queryAll, queryOne } from '../database/connection'

export const DEFAULT_PAGE_SIZE = 10
export const MAX_PAGE_SIZE = 100

const toInt = (value: unknown, fallback: number): number => {
  const n = Math.floor(Number(value))
  return Number.isFinite(n) ? n : fallback
}

/**
 * Pagination في SQL نفسه (COUNT + LIMIT/OFFSET)، فالواجهة مبتحمّلش غير الصفحة المطلوبة.
 * sql = الاستعلام الكامل بترتيبه من غير LIMIT. لو الصفحة المطلوبة أكبر من آخر صفحة بنرجّع آخر صفحة.
 */
export function queryPage<T>(sql: string, params: Record<string, unknown>, request: PageParams = {}): Page<T> {
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, toInt(request.pageSize, DEFAULT_PAGE_SIZE)))
  const total = queryOne<{ count: number }>(`SELECT COUNT(*) AS count FROM (${sql})`, params)!.count
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(pageCount, Math.max(1, toInt(request.page, 1)))
  const rows = queryAll<T>(`${sql} LIMIT @pageLimit OFFSET @pageOffset`, { ...params, pageLimit: pageSize, pageOffset: (page - 1) * pageSize })
  return { rows, total, page, pageSize, pageCount }
}
