import type { Item, ItemDetails, ItemInput, Page, PageParams, RemoveItemResult } from '@shared/types'
import { invoke } from '@/shared/api/ipc'

export const itemsApi = {
  /** كل المنتجات (للقوايم المنسدلة ونسخ القايمة) */
  list: (p: { search?: string }) => invoke<Item[]>('items:list', p),
  /** صفحة واحدة (الجدول) */
  page: (p: { search?: string } & PageParams) => invoke<Page<Item>>('items:page', p),
  details: (p: { id: number }) => invoke<ItemDetails>('items:details', p),
  create: (p: ItemInput) => invoke<number>('items:create', p),
  update: (p: ItemInput & { id: number }) => invoke<void>('items:update', p),
  remove: (p: { id: number }) => invoke<RemoveItemResult>('items:remove', p)
}
