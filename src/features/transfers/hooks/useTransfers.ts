import type { TransferFilter } from '@shared/types'
import { usePagedQuery } from '@/shared/hooks/usePagedQuery'
import { transfersApi } from '../api/transfers.api'

/** جدول التحويلات: الـ pagination والفلتر من الـ backend */
export const useTransfers = (filter: TransferFilter) => usePagedQuery((page) => transfersApi.page({ ...filter, ...page }), [filter])
