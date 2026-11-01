import type { HandleFn } from '../../lib/ipc'
import * as s from './sales.service'

export function register(handle: HandleFn): void {
  handle('sales:list', s.listSales)
  handle('sales:page', s.pageSales)
  handle('sales:get', s.getSale)
  handle('sales:create', s.createSale)
  handle('sales:update', s.updateSale)
  handle('sales:remove', s.removeSale)
}
