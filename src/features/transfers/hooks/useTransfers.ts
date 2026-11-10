import type { TransfersFilter } from '@shared/types'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { usePagedQuery } from '@/shared/hooks/usePagedQuery'
import { transfersApi } from '../api/transfers.api'

/** جدول التحويلات: الـ pagination والفلترة من الـ backend (البحث بيستنى لحد ما الكتابة تقف) */
export function useTransfers(filter: TransfersFilter) {
  const search = useDebounce(filter.search ?? '')
  const params = { ...filter, search }
  return usePagedQuery((page) => transfersApi.page({ ...params, ...page }), [params])
}
