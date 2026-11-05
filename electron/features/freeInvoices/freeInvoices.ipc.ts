import type { HandleFn } from '../../lib/ipc'
import * as s from './freeInvoices.service'

export function register(handle: HandleFn): void {
  handle('free-invoices:page', s.pageFreeInvoices)
  handle('free-invoices:get', s.getFreeInvoice)
  handle('free-invoices:create', s.createFreeInvoice)
  handle('free-invoices:update', s.updateFreeInvoice)
  handle('free-invoices:remove', s.removeFreeInvoice)
  handle('free-invoices:pay', s.payFreeInvoice)
  handle('free-invoices:remove-payment', s.removeFreeInvoicePayment)
  handle('free-invoices:to-sale', s.createSaleFromFreeInvoice)
}
