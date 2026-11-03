import type { DateFilter } from '@shared/types'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { usePagedQuery } from '@/shared/hooks/usePagedQuery'
import { useQuery } from '@/shared/hooks/useQuery'
import { customersApi } from '../api/customers.api'

/** كل العملاء مع إجماليات فواتيرهم (للقوايم المنسدلة). owing = اللي عليهم فلوس بس. */
export function useCustomers(search = '', owing = false) {
  const q = useDebounce(search)
  const { data, loading, reload } = useQuery(() => customersApi.list({ search: q, owing }), [q, owing])
  return { customers: data ?? [], loading, reload }
}

/** صفحة العملاء (الجدول): الـ pagination من الـ backend. مع فترة الإجماليات من فواتير الفترة بس. */
export function useCustomersPage(search = '', owing = false, range: DateFilter = {}) {
  const q = useDebounce(search)
  const { from, to } = range
  return usePagedQuery((page) => customersApi.page({ search: q, owing, from, to, ...page }), [q, owing, from, to])
}
