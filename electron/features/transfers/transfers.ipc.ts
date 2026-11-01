import type { HandleFn } from '../../lib/ipc'
import * as s from './transfers.service'

export function register(handle: HandleFn): void {
  handle('transfers:page', s.pageTransfers)
  handle('transfers:get', s.getTransfer)
  handle('transfers:items', s.listSourceItems)
  handle('transfers:create', s.createTransfer)
  handle('transfers:remove', s.removeTransfer)
}
