import type { Item, Page, PageParams, Transfer, TransferDetails, TransferFilter, TransferInput } from '@shared/types'
import { invoke } from '@/shared/api/ipc'

export const transfersApi = {
  /** صفحة من التحويلات اللي المخزن النشط طرف فيها */
  page: (p: TransferFilter & PageParams) => invoke<Page<Transfer>>('transfers:page', p),
  get: (p: { id: number }) => invoke<TransferDetails>('transfers:get', p),
  /** منتجات مخزن معين (نختار منها المنتجات المحوَّلة) */
  items: (p: { workspace_id: number }) => invoke<Item[]>('transfers:items', p),
  create: (p: TransferInput) => invoke<number>('transfers:create', p),
  update: (p: TransferInput & { id: number }) => invoke<void>('transfers:update', p),
  remove: (p: { id: number }) => invoke<void>('transfers:remove', p)
}
