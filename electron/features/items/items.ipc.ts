import type { HandleFn } from '../../lib/ipc'
import { listAllStores } from './items.allStores'
import * as s from './items.service'

export function register(handle: HandleFn): void {
  handle('items:list', s.listItems)
  handle('items:all-stores', listAllStores)
  handle('items:page', s.pageItems)
  handle('items:get', s.getItem)
  handle('items:details', s.getDetails)
  handle('items:create', s.createItem)
  handle('items:update', s.updateItem)
  handle('items:remove', s.removeItem)
  handle('items:updatePrices', s.updatePrices)
}
