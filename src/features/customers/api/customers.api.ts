import type { CollectInput, CustomerInput, CustomerStatement, CustomerSummary, DateFilter, Page, PageParams } from '@shared/types'
import { invoke } from '@/shared/api/ipc'

export const customersApi = {
  /** كل العملاء (للقوايم المنسدلة) */
  list: (p: { search?: string; owing?: boolean }) => invoke<CustomerSummary[]>('customers:list', p),
  /** صفحة واحدة (الجدول) */
  page: (p: { search?: string; owing?: boolean } & DateFilter & PageParams) => invoke<Page<CustomerSummary>>('customers:page', p),
  statement: (p: { id: number }) => invoke<CustomerStatement>('customers:statement', p),
  create: (p: CustomerInput) => invoke<number>('customers:create', p),
  update: (p: CustomerInput & { id: number }) => invoke<void>('customers:update', p),
  remove: (p: { id: number }) => invoke<void>('customers:remove', p),
  collect: (p: CollectInput) => invoke<number[]>('payments:collect', p),
  removePayment: (p: { id: number }) => invoke<void>('payments:remove', p)
}
