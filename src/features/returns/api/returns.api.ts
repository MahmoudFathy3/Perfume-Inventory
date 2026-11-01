import type { ReturnInput, ReturnRecord, ReturnWithLines, Page, PageParams } from '@shared/types'
import { invoke } from '@/shared/api/ipc'

export const returnsApi = {
  /** كل الفواتير (للاختيار من قايمة) */
  list: (p: { search?: string }) => invoke<ReturnRecord[]>('returns:list', p),
  /** صفحة واحدة (الجدول) */
  page: (p: { search?: string } & PageParams) => invoke<Page<ReturnRecord>>('returns:page', p),
  get: (p: { id: number }) => invoke<ReturnWithLines | null>('returns:get', p),
  create: (p: ReturnInput) => invoke<number>('returns:create', p),
  remove: (p: { id: number }) => invoke<void>('returns:remove', p)
}
