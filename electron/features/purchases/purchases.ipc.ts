import type { HandleFn } from '../../lib/ipc'
import * as s from './purchases.service'

export function register(handle: HandleFn): void {
  handle('purchases:list', s.listPurchases)
  handle('purchases:page', s.pagePurchases)
  handle('purchases:get', s.getPurchase)
  handle('purchases:create', s.createPurchase)
  handle('purchases:update', s.updatePurchase)
  handle('purchases:remove', s.removePurchase)
  handle('purchases:pay', s.payPurchase)
  handle('purchases:remove-payment', s.removePurchasePayment)
}
