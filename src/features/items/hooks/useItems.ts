import { useDebounce } from '@/shared/hooks/useDebounce'
import { usePagedQuery } from '@/shared/hooks/usePagedQuery'
import { useQuery } from '@/shared/hooks/useQuery'
import { itemsApi } from '../api/items.api'

/** كل المنتجات (للقوايم المنسدلة في الفواتير) */
export function useItems(search = '') {
  const q = useDebounce(search)
  const { data, loading, reload } = useQuery(() => itemsApi.list({ search: q }), [q])
  return { items: data ?? [], loading, reload }
}

/** صفحة المنتجات (الجدول): الـ pagination من الـ backend */
export function useItemsPage(search = '') {
  const q = useDebounce(search)
  return usePagedQuery((page) => itemsApi.page({ search: q, ...page }), [q])
}
