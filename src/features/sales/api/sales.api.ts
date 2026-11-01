import type { Sale, SaleInput, SaleWithLines, Page, PageParams } from '@shared/types'
import { invoke } from '@/shared/api/ipc'

export const salesApi = {
  /** كل الفواتير (للاختيار من قايمة) */
  list: (p: { search?: string }) => invoke<Sale[]>('sales:list', p),
  /** صفحة واحدة (الجدول) */
  page: (p: { search?: string } & PageParams) => invoke<Page<Sale>>('sales:page', p),
  get: (p: { id: number }) => invoke<SaleWithLines | null>('sales:get', p),
  create: (p: SaleInput) => invoke<number>('sales:create', p),
  update: (p: SaleInput & { id: number }) => invoke<void>('sales:update', p),
  remove: (p: { id: number }) => invoke<void>('sales:remove', p)
}
