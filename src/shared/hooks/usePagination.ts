import { useEffect, useState } from 'react'
import { PAGE_SIZES } from '../constants'

export interface PaginationState<T> {
  pageRows: T[]
  page: number
  pageCount: number
  pageSize: number
  total: number
  setPage: (page: number) => void
  setPageSize: (size: number) => void
}

/**
 * تقسيم قايمة صغيرة موجودة أصلًا في الواجهة (كشف حساب عميل، حركات منتج، سجل النسخ الاحتياطي).
 * القوايم الكبيرة (المنتجات، الفواتير...) الـ pagination بتاعها في الـ backend: شوف usePagedQuery.
 */
export function usePagination<T>(rows: T[], opts: { resetKey?: string; initialSize?: number } = {}): PaginationState<T> {
  const { resetKey = '', initialSize = PAGE_SIZES[0] } = opts
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(initialSize)

  useEffect(() => setPage(1), [resetKey, pageSize])

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize))
  const current = Math.min(page, pageCount)
  const pageRows = rows.slice((current - 1) * pageSize, current * pageSize)

  return { pageRows, page: current, pageCount, pageSize, total: rows.length, setPage, setPageSize }
}
