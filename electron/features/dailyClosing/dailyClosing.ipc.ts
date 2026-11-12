import type { HandleFn } from '../../lib/ipc'
import * as s from './dailyClosing.service'

export function register(handle: HandleFn): void {
  handle('daily:close', s.closeDay)
  handle('daily:reopen', s.reopenDay)
}
