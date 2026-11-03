import type { WarehouseItemInput, WarehouseShipmentInput } from '@shared/types'
import { getDb } from '../../database/connection'
import { AppError, money, qty, today } from '../../lib/errors'
import { activeWorkspaceId } from '../../lib/workspace'
import * as workspaces from '../workspaces/workspaces.repository'
import * as repo from './warehouse.repository'

/** كل عمليات الصفحة دي على المخزن الخارجي النشط بس */
function inWarehouse(): void {
  if (workspaces.findById(activeWorkspaceId())?.kind !== 'warehouse') throw new AppError('NOT_WAREHOUSE')
}

/** عدد قطع صحيح >= 0 (الفاضي = 0) */
function count(v: unknown): number {
  const n = Number(v ?? 0)
  if (!Number.isInteger(n) || n < 0) throw new AppError('INVALID_QUANTITY')
  return n
}

/** اسم المنتج مطلوب ومينفعش يتكرر في نفس المخزن. المبالغ للقطعة (الفاضي = 0). */
function cleanItem(input: WarehouseItemInput, excludeId = 0) {
  const name = String(input.name ?? '').trim()
  if (!name) throw new AppError('NAME_REQUIRED')
  if (repo.findItemByName(name, excludeId)) throw new AppError('DUPLICATE_NAME')
  return {
    name,
    quantity: count(input.quantity),
    unit_price: money(input.unit_price),
    shipping: money(input.shipping),
    customs: money(input.customs),
    notes: input.notes?.trim() || null
  }
}

export function listItems(p: { search?: string }) {
  inWarehouse()
  return repo.findItems(p.search)
}

export function createItem(input: WarehouseItemInput): number {
  inWarehouse()
  return repo.insertItem(cleanItem(input))
}

export function updateItem({ id, ...input }: WarehouseItemInput & { id: number }): void {
  inWarehouse()
  if (!repo.findItem(id)) throw new AppError('ITEM_NOT_FOUND')
  repo.updateItem(id, cleanItem(input, id))
}

/** المنتج اللي اتشحن منه قبل كده مبيتحذفش (IN_USE) علشان سجل الشحنات يفضل كامل */
export function removeItem({ id }: { id: number }): void {
  inWarehouse()
  repo.removeItem(id)
}

export function listShipments() {
  inWarehouse()
  return repo.findShipments()
}

/** شحنة لمصر (الفعلي أو شراكة): الكميات بتتخصم من المخزن الخارجي والشحنة بتبدأ "في الطريق" */
export const createShipment = (input: WarehouseShipmentInput): number =>
  getDb().transaction(() => {
    inWarehouse()
    const destination = workspaces.findById(Number(input.workspace_id))
    if (!destination || destination.kind === 'warehouse') throw new AppError('WORKSPACE_NOT_FOUND')
    if (destination.closed_at) throw new AppError('WORKSPACE_CLOSED')
    const lines = (Array.isArray(input.items) ? input.items : []).filter((l) => l.item_id)
    if (lines.length === 0) throw new AppError('NO_LINES')

    const id = repo.insertShipment({ ship_date: input.ship_date || today(), workspace_id: destination.id, notes: input.notes?.trim() || null })
    for (const l of lines) {
      const item = repo.findItem(Number(l.item_id))
      if (!item) throw new AppError('ITEM_NOT_FOUND')
      const quantity = qty(l.quantity)
      if (item.quantity < quantity) throw new AppError('OUT_OF_STOCK')
      repo.changeQuantity(item.id, -quantity)
      repo.insertShipmentLine(id, item.id, quantity)
    }
    return id
  })()

/** وصلت (بتاريخ النهارده) / لسه في الطريق */
export function setArrived({ id, arrived }: { id: number; arrived: boolean }): void {
  inWarehouse()
  if (!repo.findShipment(id)) throw new AppError('SHIPMENT_NOT_FOUND')
  repo.setStatus(id, arrived ? 'arrived' : 'in_transit', arrived ? today() : null)
}

/** حذف الشحنة بيرجّع كمياتها للمخزن الخارجي */
export const removeShipment = ({ id }: { id: number }): void =>
  getDb().transaction(() => {
    inWarehouse()
    if (!repo.findShipment(id)) throw new AppError('SHIPMENT_NOT_FOUND')
    for (const l of repo.findShipmentLines(id)) repo.changeQuantity(l.item_id, l.quantity)
    repo.removeShipment(id)
  })()
