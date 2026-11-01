import { useDebounce } from '@/shared/hooks/useDebounce'
import { usePagedQuery } from '@/shared/hooks/usePagedQuery'
import { returnsApi } from '../api/returns.api'

/** صفحة returns (الجدول): الـ pagination من الـ backend */
export function useReturns(search = '') {
  const q = useDebounce(search)
  return usePagedQuery((page) => returnsApi.page({ search: q, ...page }), [q])
}
