import assert from 'node:assert/strict'
import test from 'node:test'
import * as transfers from '../features/transfers/transfers.service'
import * as warehouse from '../features/warehouse/warehouse.service'
import * as ws from '../features/workspaces/workspaces.service'
import { PERSONAL_WORKSPACE_ID as PERSONAL, withWorkspace } from '../lib/workspace'
import { err, useTestDb } from './helpers'

useTestDb()

let saudi = 0
let partnership = 0
let khalifa = 0
let rose = 0
const inSaudi = <T>(fn: () => T) => withWorkspace(saudi, fn)
const qtyOf = (id: number) => inSaudi(() => warehouse.listItems({}).find((i) => i.id === id)!.quantity)

test('المخزن الخارجي: مخزن لوحده بالاسم بس، والاسم مطلوب ومينفعش يتكرر', () => {
  assert.equal(err(() => ws.createWorkspace({ kind: 'warehouse', name: ' ' })), 'NAME_REQUIRED')
  saudi = ws.createWorkspace({ kind: 'warehouse', name: 'مخزن السعودية' })
  partnership = ws.createWorkspace({ partners: ['محمود', 'أحمد'] })
  assert.equal(err(() => ws.createWorkspace({ kind: 'warehouse', name: 'مخزن السعوديه' })), 'DUPLICATE_NAME')

  const w = ws.listWorkspaces().find((x) => x.id === saudi)!
  assert.deepEqual([w.kind, w.name, w.partners], ['warehouse', 'مخزن السعودية', []])
  ws.updateWorkspace({ id: saudi, name: 'مخزن جدة' })
  assert.equal(ws.listWorkspaces().find((x) => x.id === saudi)!.name, 'مخزن جدة')

  // بيانات المخزن الخارجي مبتتفتحش من مخزن تاني، ومينفعش تحويل له
  assert.equal(err(() => warehouse.listItems({})), 'NOT_WAREHOUSE')
  assert.equal(err(() => transfers.createTransfer({ from_workspace_id: PERSONAL, to_workspace_id: saudi, kind: 'half', items: [] })), 'INVALID_TRANSFER')
})

test('منتجات المخزن الخارجي: الاسم مطلوب ومينفعش يتكرر، والكمية رقم صحيح', () => {
  inSaudi(() => {
    khalifa = warehouse.createItem({ name: 'خليفه', quantity: 10 })
    rose = warehouse.createItem({ name: 'روز', quantity: 4, notes: 'كرتونة' })
    assert.equal(err(() => warehouse.createItem({ name: 'خليفة', quantity: 1 })), 'DUPLICATE_NAME')
    assert.equal(err(() => warehouse.createItem({ name: ' ', quantity: 1 })), 'NAME_REQUIRED')
    assert.equal(err(() => warehouse.createItem({ name: 'عود', quantity: 1.5 })), 'INVALID_QUANTITY')
    assert.equal(err(() => warehouse.createItem({ name: 'عود', quantity: 1, unit_price: -5 })), 'INVALID_NUMBER')

    // المبالغ للقطعة بالريال (الفاضي = صفر)
    const oud = warehouse.createItem({ name: 'عود', quantity: 2, unit_price: 500, shipping: '30', customs: 20.5 })
    const saved = warehouse.listItems({}).find((i) => i.id === oud)!
    assert.deepEqual([saved.unit_price, saved.shipping, saved.customs], [500, 30, 20.5])
    assert.deepEqual(warehouse.listItems({}).find((i) => i.id === khalifa)!.unit_price, 0)
    warehouse.removeItem({ id: oud })

    warehouse.updateItem({ id: rose, name: 'روز', quantity: 5 })
    assert.deepEqual(warehouse.listItems({ search: 'رو' }).map((i) => [i.name, i.quantity, i.notes]), [['روز', 5, null]])
  })
  // مخزن خارجي تاني ليه منتجاته لوحده
  const other = ws.createWorkspace({ kind: 'warehouse', name: 'مخزن دبي' })
  withWorkspace(other, () => {
    assert.deepEqual(warehouse.listItems({}), [])
    warehouse.createItem({ name: 'خليفه', quantity: 1 })
  })
})

test('الشحنة بتخصم من المخزن الخارجي، ومينفعش تشحن أكتر من المتاح ولا لمخزن خارجي', () => {
  inSaudi(() => {
    assert.equal(err(() => warehouse.createShipment({ workspace_id: PERSONAL, items: [{ item_id: khalifa, quantity: 11 }] })), 'OUT_OF_STOCK')
    assert.equal(err(() => warehouse.createShipment({ workspace_id: saudi, items: [{ item_id: khalifa, quantity: 1 }] })), 'WORKSPACE_NOT_FOUND')
    assert.equal(err(() => warehouse.createShipment({ workspace_id: PERSONAL, items: [] })), 'NO_LINES')

    warehouse.createShipment({ workspace_id: PERSONAL, ship_date: '2026-01-01', items: [{ item_id: khalifa, quantity: 3 }, { item_id: rose, quantity: 2 }] })
    warehouse.createShipment({ workspace_id: partnership, ship_date: '2026-02-01', notes: 'للشراكة', items: [{ item_id: khalifa, quantity: 7 }] })
  })
  assert.equal(qtyOf(khalifa), 0) // الشحنة الفاشلة مخصمتش حاجة
  assert.equal(qtyOf(rose), 3)

  const [toPartnership, toPersonal] = inSaudi(() => warehouse.listShipments())
  assert.deepEqual([toPartnership.workspace_id, toPartnership.pieces, toPartnership.status], [partnership, 7, 'in_transit'])
  assert.deepEqual(toPersonal.items.map((l) => [l.name, l.quantity]), [['خليفه', 3], ['روز', 2]])

  // الشراكة اللي عليها شحنة مبتتحذفش
  assert.equal(err(() => ws.removeWorkspace({ id: partnership })), 'WORKSPACE_NOT_EMPTY')
})

test('وصلت / لسه في الطريق، وحذف الشحنة بيرجّع الكميات، والمنتج المشحون منه مبيتحذفش', () => {
  inSaudi(() => {
    const [latest, first] = warehouse.listShipments()
    warehouse.setArrived({ id: first.id, arrived: true })
    const arrived = warehouse.listShipments().find((s) => s.id === first.id)!
    assert.equal(arrived.status, 'arrived')
    assert.ok(arrived.arrived_date)
    warehouse.setArrived({ id: first.id, arrived: false })
    assert.equal(warehouse.listShipments().find((s) => s.id === first.id)!.arrived_date, null)

    assert.equal(err(() => warehouse.removeItem({ id: khalifa })), 'SQLITE_CONSTRAINT_FOREIGNKEY') // الـ IPC بيحوّله لـ IN_USE

    warehouse.removeShipment({ id: latest.id })
    assert.equal(warehouse.listShipments().length, 1)
    assert.equal(err(() => warehouse.removeShipment({ id: latest.id })), 'SHIPMENT_NOT_FOUND')
  })
  assert.equal(qtyOf(khalifa), 7)
  assert.equal(err(() => ws.removeWorkspace({ id: saudi })), 'WORKSPACE_NOT_EMPTY')
})
