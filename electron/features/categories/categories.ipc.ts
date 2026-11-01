import type { HandleFn } from '../../lib/ipc'
import * as s from './categories.service'

export function register(handle: HandleFn): void {
  handle('categories:list', s.listCategories)
  handle('categories:page', s.pageCategories)
  handle('categories:create', s.createCategory)
  handle('categories:update', s.updateCategory)
  handle('categories:remove', s.removeCategory)
}
