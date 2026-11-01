import { usePagedQuery } from '@/shared/hooks/usePagedQuery'
import { transfersApi } from '../api/transfers.api'

/** جدول التحويلات: الـ pagination من الـ backend */
export const useTransfers = () => usePagedQuery((page) => transfersApi.page(page))
