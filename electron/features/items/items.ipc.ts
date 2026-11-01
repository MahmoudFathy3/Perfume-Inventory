import type { HandleFn } from '../../lib/ipc'
import * as s from './items.service'

export function register(handle: HandleFn): void {
  handle('items:list', s.listItems)
  handle('items:page', s.pageItems)
  handle('items:get', s.getItem)
  handle('items:details', s.getDetails)
  handle('items:create', s.createItem)
  handle('items:update', s.updateItem)
  handle('items:remove', s.removeItem)
  handle('items:updatePrices', s.updatePrices)
}
