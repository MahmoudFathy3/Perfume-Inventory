import type { DateFilter, Purchase, PurchaseInput, PurchasePaymentInput, PurchaseWithLines, Page, PageParams } from '@shared/types'
import { invoke } from '@/shared/api/ipc'

export const purchasesApi = {
  /** كل الفواتير (للاختيار من قايمة) */
  list: (p: { search?: string }) => invoke<Purchase[]>('purchases:list', p),
  /** صفحة واحدة (الجدول) */
  page: (p: { search?: string; partnerId?: number } & DateFilter & PageParams) => invoke<Page<Purchase>>('purchases:page', p),
  get: (p: { id: number }) => invoke<PurchaseWithLines | null>('purchases:get', p),
  create: (p: PurchaseInput) => invoke<number>('purchases:create', p),
  update: (p: PurchaseInput & { id: number }) => invoke<void>('purchases:update', p),
  remove: (p: { id: number }) => invoke<void>('purchases:remove', p),
  /** دفعة للمورد على الفاتورة */
  pay: (p: PurchasePaymentInput) => invoke<number>('purchases:pay', p),
  removePayment: (p: { id: number }) => invoke<void>('purchases:remove-payment', p)
}
