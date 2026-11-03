import type { HandleFn } from '../../lib/ipc'
import * as s from './partners.service'

export function register(handle: HandleFn): void {
  handle('partners:ledger', s.ledger)
  handle('partners:sales', s.partnerSales)
  handle('partners:pay', s.addPayment)
  handle('partners:transfer', s.transferBetweenPartners)
  handle('partners:remove-payment', s.removePayment)
}
