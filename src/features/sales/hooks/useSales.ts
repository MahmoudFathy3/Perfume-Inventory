import { useDebounce } from '@/shared/hooks/useDebounce'
import { usePagedQuery } from '@/shared/hooks/usePagedQuery'
import { salesApi } from '../api/sales.api'

/** صفحة sales (الجدول): الـ pagination من الـ backend */
export function useSales(search = '', partnerId?: number) {
  const q = useDebounce(search)
  return usePagedQuery((page) => salesApi.page({ search: q, partnerId, ...page }), [q, partnerId])
}
