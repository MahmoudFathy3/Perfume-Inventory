import type { HandleFn } from '../../lib/ipc'
import * as s from './saleOrders.service'

export function register(handle: HandleFn): void {
  handle('orders:page', s.pageOrders)
  handle('orders:count', s.countOrders)
  handle('orders:get', s.getOrder)
  handle('orders:create', s.createOrder)
  handle('orders:update', s.updateOrder)
  handle('orders:remove', s.removeOrder)
  handle('orders:confirm', s.confirmOrder)
  handle('orders:from-sale', s.saleToOrder)
  handle('orders:reserved', s.reservedSummary)
  handle('orders:for-item', s.ordersForItem)
}
