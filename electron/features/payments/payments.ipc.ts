import type { HandleFn } from '../../lib/ipc'
import * as s from './payments.service'

export function register(handle: HandleFn): void {
  handle('payments:collect', s.collect)
  handle('payments:remove', s.removePayment)
}
