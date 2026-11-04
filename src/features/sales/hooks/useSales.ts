import type { DateFilter } from '@shared/types'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { usePagedQuery } from '@/shared/hooks/usePagedQuery'
import { salesApi } from '../api/sales.api'

/** صفحة sales (الجدول): الـ pagination والفلتر (الشريك والفترة) من الـ backend */
export function useSales(search = '', partnerId?: number, range: DateFilter = {}) {
  const q = useDebounce(search)
  const { from, to } = range
  return usePagedQuery((page) => salesApi.page({ search: q, partnerId, from, to, ...page }), [q, partnerId, from, to])
}
