import { useDebounce } from '@/shared/hooks/useDebounce'
import { usePagedQuery } from '@/shared/hooks/usePagedQuery'
import { purchasesApi } from '../api/purchases.api'

/** صفحة purchases (الجدول): الـ pagination من الـ backend */
export function usePurchases(search = '') {
  const q = useDebounce(search)
  return usePagedQuery((page) => purchasesApi.page({ search: q, ...page }), [q])
}
