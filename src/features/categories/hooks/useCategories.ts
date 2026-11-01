import { useDebounce } from '@/shared/hooks/useDebounce'
import { usePagedQuery } from '@/shared/hooks/usePagedQuery'
import { useQuery } from '@/shared/hooks/useQuery'
import { categoriesApi } from '../api/categories.api'

/** كل الأصناف (للقوايم المنسدلة) */
export function useCategories(search = '') {
  const q = useDebounce(search)
  const { data, loading, reload } = useQuery(() => categoriesApi.list({ search: q }), [q])
  return { categories: data ?? [], loading, reload }
}

/** صفحة الأصناف (الجدول): الـ pagination من الـ backend */
export function useCategoriesPage(search = '') {
  const q = useDebounce(search)
  return usePagedQuery((page) => categoriesApi.page({ search: q, ...page }), [q])
}
