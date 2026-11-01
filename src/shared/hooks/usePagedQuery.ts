import { useEffect, useState } from 'react'
import type { Page, PageParams } from '@shared/types'
import { PAGE_SIZES } from '../constants'
import type { PaginationState } from './usePagination'
import { useQuery } from './useQuery'

export interface PagedQuery<T> extends PaginationState<T> {
  loading: boolean
  reload: () => void
}

/**
 * قايمة بـ pagination من الـ backend: الواجهة بتطلب صفحة واحدة بس (page + pageSize) والـ backend بيرجّع الصفحة والإجمالي.
 * deps = أي حاجة تغيّر النتيجة (البحث، الفلتر): لما تتغير بنرجع لأول صفحة.
 * بيرجّع نفس شكل usePagination علشان <Pagination {...paged} /> يشتغل عليه.
 */
export function usePagedQuery<T>(fetcher: (page: PageParams) => Promise<Page<T>>, deps: unknown[] = []): PagedQuery<T> {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[0])
  const key = JSON.stringify(deps)

  useEffect(() => setPage(1), [key, pageSize])

  // بنحفظ مع الرد رقم الصفحة اللي اتطلبت، علشان نعرف الرد ده ردّ على الطلب الحالي ولا على طلب قديم لسه مخلصش
  const { data, loading, reload } = useQuery(() => fetcher({ page, pageSize }).then((result) => ({ ...result, requested: page })), [key, page, pageSize])

  // الـ backend بيرجّع آخر صفحة لو المطلوبة بقت أكبر منها (مثلًا بعد حذف آخر صف)
  useEffect(() => {
    if (data && data.requested === page && data.page !== page) setPage(data.page)
  }, [data, page])

  return {
    pageRows: data?.rows ?? [],
    page: data?.page ?? page,
    pageCount: data?.pageCount ?? 1,
    pageSize,
    total: data?.total ?? 0,
    setPage,
    setPageSize,
    loading,
    reload
  }
}
