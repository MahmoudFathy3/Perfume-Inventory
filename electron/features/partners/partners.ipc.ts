import type { HandleFn } from '../../lib/ipc'
import * as s from './partners.service'

export function register(handle: HandleFn): void {
  handle('partners:ledger', s.ledger)
  handle('partners:statement', s.statement)
  handle('partners:sales', s.partnerSales)
  handle('partners:closing', s.monthlyClosing)
  handle('partners:close-month', s.closeMonth)
  handle('partners:reopen-month', s.reopenMonth)
  handle('partners:closed-months', s.closedMonths)
  handle('partners:pay', s.addPayment)
  handle('partners:transfer', s.transferBetweenPartners)
  handle('partners:remove-payment', s.removePayment)
}
