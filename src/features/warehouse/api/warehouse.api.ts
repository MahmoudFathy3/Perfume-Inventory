import type { WarehouseItem, WarehouseItemInput, WarehouseShipment, WarehouseShipmentInput } from '@shared/types'
import { invoke } from '@/shared/api/ipc'

/** مخزن السعودية: كميات وشحنات بس */
export const warehouseApi = {
  items: (p: { search?: string }) => invoke<WarehouseItem[]>('warehouse:items', p),
  createItem: (p: WarehouseItemInput) => invoke<number>('warehouse:create-item', p),
  updateItem: (p: WarehouseItemInput & { id: number }) => invoke<void>('warehouse:update-item', p),
  removeItem: (p: { id: number }) => invoke<void>('warehouse:remove-item', p),
  shipments: () => invoke<WarehouseShipment[]>('warehouse:shipments'),
  createShipment: (p: WarehouseShipmentInput) => invoke<number>('warehouse:create-shipment', p),
  setArrived: (p: { id: number; arrived: boolean }) => invoke<void>('warehouse:set-arrived', p),
  removeShipment: (p: { id: number }) => invoke<void>('warehouse:remove-shipment', p)
}
