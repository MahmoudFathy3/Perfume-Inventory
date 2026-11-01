import type { HandleFn } from '../../lib/ipc'
import * as s from './customers.service'

export function register(handle: HandleFn): void {
  handle('customers:list', s.listCustomers)
  handle('customers:page', s.pageCustomers)
  handle('customers:create', s.createCustomer)
  handle('customers:update', s.updateCustomer)
  handle('customers:remove', s.removeCustomer)
  handle('customers:statement', s.getStatement)
}
