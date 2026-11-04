import type { Item, Page, PageParams, Transfer, TransferDetails, TransferInput, TransferMoney, TransferPaymentInput, TransfersFilter, TransferSummaryRow } from '@shared/types'
import { invoke } from '@/shared/api/ipc'

export const transfersApi = {
  /** صفحة من التحويلات اللي المخزن النشط طرف فيها (بالفلتر) */
  page: (p: TransfersFilter & PageParams) => invoke<Page<Transfer>>('transfers:page', p),
  /** عدد القطع لكل اتجاه + شخص + نوع (بنفس الفلتر) */
  summary: (p: TransfersFilter) => invoke<TransferSummaryRow[]>('transfers:summary', p),
  get: (p: { id: number }) => invoke<TransferDetails>('transfers:get', p),
  /** منتجات مخزن معين (نختار منها المنتجات المحوَّلة) */
  items: (p: { workspace_id: number }) => invoke<Item[]>('transfers:items', p),
  create: (p: TransferInput) => invoke<number>('transfers:create', p),
  /** تعديل تحويل: القديم بيتعكس والجديد بيتعمل في نفس الخطوة */
  update: (p: TransferInput & { id: number }) => invoke<void>('transfers:update', p),
  remove: (p: { id: number }) => invoke<void>('transfers:remove', p),
  /** دفعة على تحويل بيع بسعر (بتتسجل تسوية شريك) */
  pay: (p: TransferPaymentInput) => invoke<number>('transfers:pay', p),
  /** حذف دفعة واحدة على التحويل */
  removePayment: (p: { transfer_id: number; id: number }) => invoke<void>('transfers:remove-payment', p),
  /** التحويل يرجع "لسه متدفعش" (كل دفعاته بتتحذف) */
  unpay: (p: { transfer_id: number }) => invoke<void>('transfers:unpay', p),
  /** الفلوس اللي للمخزن النشط واللي عليه من تحويلات البيع */
  money: () => invoke<TransferMoney>('transfers:money')
}
