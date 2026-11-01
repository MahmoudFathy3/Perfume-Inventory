import type { Category, Page, PageParams } from '@shared/types'
import { invoke } from '@/shared/api/ipc'

export const categoriesApi = {
  /** كل الأصناف (للقوايم المنسدلة) */
  list: (p: { search?: string }) => invoke<Category[]>('categories:list', p),
  /** صفحة واحدة (الجدول) */
  page: (p: { search?: string } & PageParams) => invoke<Page<Category>>('categories:page', p),
  create: (p: { name: string }) => invoke<number>('categories:create', p),
  update: (p: { id: number; name: string }) => invoke<void>('categories:update', p),
  remove: (p: { id: number }) => invoke<void>('categories:remove', p)
}
