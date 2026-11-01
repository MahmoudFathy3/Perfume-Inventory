import type { HandleFn } from '../../lib/ipc'
import { overview, summary } from './dashboard.service'

export function register(handle: HandleFn): void {
  handle('dashboard:summary', summary)
  handle('dashboard:overview', overview)
}
