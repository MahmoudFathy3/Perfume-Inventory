import type { DateFilter } from '@shared/types'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { usePagedQuery } from '@/shared/hooks/usePagedQuery'
import { returnsApi } from '../api/returns.api'

/** صفحة returns (الجدول): الـ pagination والفترة من الـ backend */
export function useReturns(search = '', range: DateFilter = {}) {
  const q = useDebounce(search)
  const { from, to } = range
  return usePagedQuery((page) => returnsApi.page({ search: q, from, to, ...page }), [q, from, to])
}
