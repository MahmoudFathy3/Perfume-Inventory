import type { HandleFn } from '../../lib/ipc'
import * as s from './returns.service'

export function register(handle: HandleFn): void {
  handle('returns:list', s.listReturns)
  handle('returns:page', s.pageReturns)
  handle('returns:get', s.getReturn)
  handle('returns:create', s.createReturn)
  handle('returns:remove', s.removeReturn)
}
