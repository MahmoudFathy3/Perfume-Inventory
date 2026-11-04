import type { DateFilter } from '@shared/types'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { usePagedQuery } from '@/shared/hooks/usePagedQuery'
import { purchasesApi } from '../api/purchases.api'

/** صفحة purchases (الجدول): الـ pagination والفلتر (الشريك والفترة) من الـ backend */
export function usePurchases(search = '', partnerId?: number, range: DateFilter = {}) {
  const q = useDebounce(search)
  const { from, to } = range
  return usePagedQuery((page) => purchasesApi.page({ search: q, partnerId, from, to, ...page }), [q, partnerId, from, to])
}
