import { normalizeArabic } from './normalizeArabic'

export interface SearchClause {
  where: string
  params: { search?: string }
}

/** بيبني شرط البحث لأي feature: searchClause(['name'], 'احمد') */
export function searchClause(columns: string[], term: string | undefined, prefix: 'WHERE' | 'AND' = 'WHERE'): SearchClause {
  const q = normalizeArabic(term).replace(/[\\%_]/g, '\\$&')
  if (!q) return { where: '', params: {} }
  const conditions = columns.map((c) => `norm(${c}) LIKE @search ESCAPE '\\'`)
  return { where: `${prefix} (${conditions.join(' OR ')})`, params: { search: `%${q}%` } }
}
