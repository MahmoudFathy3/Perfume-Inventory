import type { Item, ItemDetails, ItemInput, Page, PageParams, RemoveItemResult } from '@shared/types'
import { invoke } from '@/shared/api/ipc'

export const itemsApi = {
  /** كل المنتجات (للقوايم المنسدلة ونسخ القايمة) */
  list: (p: { search?: string }) => invoke<Item[]>('items:list', p),
  /** منتجات المخزون الفعلي وكل الشراكات من غير تكرار (الكميات متجمّعة) */
  allStores: () => invoke<Item[]>('items:all-stores'),
  /** صفحة واحدة (الجدول) */
  /** reserved = المنتجات اللي ليها قطع محجوزة في فواتير تحت التجهيز بس */
  page: (p: { search?: string; reserved?: boolean } & PageParams) => invoke<Page<Item>>('items:page', p),
  details: (p: { id: number }) => invoke<ItemDetails>('items:details', p),
  create: (p: ItemInput) => invoke<number>('items:create', p),
  update: (p: ItemInput & { id: number }) => invoke<void>('items:update', p),
  remove: (p: { id: number }) => invoke<RemoveItemResult>('items:remove', p)
}
