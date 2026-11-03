import type { Item, Page, PageParams, Transfer, TransferDetails, TransferInput, TransfersFilter } from '@shared/types'
import { invoke } from '@/shared/api/ipc'

export const transfersApi = {
  /** صفحة من التحويلات اللي المخزن النشط طرف فيها (بالفلتر) */
  page: (p: TransfersFilter & PageParams) => invoke<Page<Transfer>>('transfers:page', p),
  get: (p: { id: number }) => invoke<TransferDetails>('transfers:get', p),
  /** منتجات مخزن معين (نختار منها المنتجات المحوَّلة) */
  items: (p: { workspace_id: number }) => invoke<Item[]>('transfers:items', p),
  create: (p: TransferInput) => invoke<number>('transfers:create', p),
  /** تعديل تحويل: القديم بيتعكس والجديد بيتعمل في نفس الخطوة */
  update: (p: TransferInput & { id: number }) => invoke<void>('transfers:update', p),
  remove: (p: { id: number }) => invoke<void>('transfers:remove', p)
}
