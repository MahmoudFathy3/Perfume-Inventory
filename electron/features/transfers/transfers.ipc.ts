import type { HandleFn } from '../../lib/ipc'
import * as s from './transfers.service'

export function register(handle: HandleFn): void {
  handle('transfers:page', s.pageTransfers)
  handle('transfers:summary', s.summarizeTransfers)
  handle('transfers:get', s.getTransfer)
  handle('transfers:items', s.listSourceItems)
  handle('transfers:create', s.createTransfer)
  handle('transfers:update', s.updateTransfer)
  handle('transfers:pay', s.payTransfer)
  handle('transfers:remove-payment', s.removeTransferPayment)
  handle('transfers:unpay', s.unpayTransfer)
  handle('transfers:money', s.transferMoney)
  handle('transfers:remove', s.removeTransfer)
}
