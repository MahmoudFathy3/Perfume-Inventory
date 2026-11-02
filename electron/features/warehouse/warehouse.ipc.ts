import type { HandleFn } from '../../lib/ipc'
import * as s from './warehouse.service'

export function register(handle: HandleFn): void {
  handle('warehouse:items', s.listItems)
  handle('warehouse:create-item', s.createItem)
  handle('warehouse:update-item', s.updateItem)
  handle('warehouse:remove-item', s.removeItem)
  handle('warehouse:shipments', s.listShipments)
  handle('warehouse:create-shipment', s.createShipment)
  handle('warehouse:set-arrived', s.setArrived)
  handle('warehouse:remove-shipment', s.removeShipment)
}
