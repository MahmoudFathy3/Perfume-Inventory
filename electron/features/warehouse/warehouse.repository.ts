import type { WarehouseItem, WarehouseShipment, WarehouseShipmentLine } from '@shared/types'
import { execute, queryAll, queryOne } from '../../database/connection'
import { searchClause } from '../../lib/search'
import { activeWorkspaceId, inWorkspace } from '../../lib/workspace'

// كل الاستعلامات محصورة في المخزن الخارجي النشط (warehouse_id)

const COLUMNS = 'id, name, quantity, unit_price, shipping, customs, notes'
type ItemRow = { name: string; quantity: number; unit_price: number; shipping: number; customs: number; notes: string | null }

export function findItems(search?: string): WarehouseItem[] {
  const { where, params } = searchClause(['name', 'notes'], search, 'AND')
  return queryAll<WarehouseItem>(`SELECT ${COLUMNS} FROM warehouse_items WHERE ${inWorkspace('warehouse_id')} ${where} ORDER BY name`, params)
}

export const findItem = (id: number) =>
  queryOne<WarehouseItem>(`SELECT ${COLUMNS} FROM warehouse_items WHERE id = ? AND ${inWorkspace('warehouse_id')}`, [id])

/** منتج تاني بنفس الاسم في نفس المخزن (من غير تفرقة همزة/تاء مربوطة) */
export const findItemByName = (name: string, excludeId = 0) =>
  queryOne<{ id: number }>(`SELECT id FROM warehouse_items WHERE ${inWorkspace('warehouse_id')} AND norm(name) = norm(?) AND id != ?`, [name, excludeId])

export const insertItem = (i: ItemRow) =>
  execute(
    `INSERT INTO warehouse_items(warehouse_id, name, quantity, unit_price, shipping, customs, notes)
     VALUES (@warehouse_id, @name, @quantity, @unit_price, @shipping, @customs, @notes)`,
    { ...i, warehouse_id: activeWorkspaceId() }
  )
export const updateItem = (id: number, i: ItemRow) =>
  void execute(
    'UPDATE warehouse_items SET name = @name, quantity = @quantity, unit_price = @unit_price, shipping = @shipping, customs = @customs, notes = @notes WHERE id = @id',
    { ...i, id }
  )
export const removeItem = (id: number) => void execute(`DELETE FROM warehouse_items WHERE id = ? AND ${inWorkspace('warehouse_id')}`, [id])
export const changeQuantity = (id: number, delta: number) => void execute('UPDATE warehouse_items SET quantity = quantity + ? WHERE id = ?', [delta, id])

/** الشحنات (الأحدث الأول) ومعاها سطورها وعدد القطع */
export function findShipments(): WarehouseShipment[] {
  const shipments = queryAll<Omit<WarehouseShipment, 'items' | 'pieces'>>(
    `SELECT id, ship_date, workspace_id, status, arrived_date, notes FROM warehouse_shipments
     WHERE ${inWorkspace('warehouse_id')} ORDER BY ship_date DESC, id DESC`
  )
  const lines = new Map<number, WarehouseShipmentLine[]>()
  const rows = queryAll<WarehouseShipmentLine & { shipment_id: number }>(
    `SELECT l.shipment_id, l.item_id, i.name, l.quantity FROM warehouse_shipment_items l
     JOIN warehouse_items i ON i.id = l.item_id WHERE ${inWorkspace('i.warehouse_id')} ORDER BY l.id`
  )
  for (const { shipment_id, ...line } of rows) lines.set(shipment_id, [...(lines.get(shipment_id) ?? []), line])
  return shipments.map((s) => {
    const items = lines.get(s.id) ?? []
    return { ...s, items, pieces: items.reduce((sum, l) => sum + l.quantity, 0) }
  })
}

export const findShipment = (id: number) =>
  queryOne<{ id: number }>(`SELECT id FROM warehouse_shipments WHERE id = ? AND ${inWorkspace('warehouse_id')}`, [id])
export const findShipmentLines = (id: number) =>
  queryAll<{ item_id: number; quantity: number }>('SELECT item_id, quantity FROM warehouse_shipment_items WHERE shipment_id = ?', [id])

export const insertShipment = (s: { ship_date: string; workspace_id: number; notes: string | null }) =>
  execute(
    'INSERT INTO warehouse_shipments(warehouse_id, ship_date, workspace_id, notes) VALUES (@warehouse_id, @ship_date, @workspace_id, @notes)',
    { ...s, warehouse_id: activeWorkspaceId() }
  )
export const insertShipmentLine = (shipmentId: number, itemId: number, quantity: number) =>
  void execute('INSERT INTO warehouse_shipment_items(shipment_id, item_id, quantity) VALUES (?, ?, ?)', [shipmentId, itemId, quantity])
export const setStatus = (id: number, status: 'in_transit' | 'arrived', arrivedDate: string | null) =>
  void execute('UPDATE warehouse_shipments SET status = ?, arrived_date = ? WHERE id = ?', [status, arrivedDate, id])
export const removeShipment = (id: number) => void execute('DELETE FROM warehouse_shipments WHERE id = ?', [id])
