import assert from 'node:assert/strict'
import test from 'node:test'
import * as categories from '../features/categories/categories.service'
import * as items from '../features/items/items.service'
import * as transfers from '../features/transfers/transfers.service'
import * as ws from '../features/workspaces/workspaces.service'
import { PERSONAL_WORKSPACE_ID as PERSONAL, withWorkspace } from '../lib/workspace'
import { useTestDb } from './helpers'

useTestDb()

const zero = { quantity: 0, purchase_price: 0, selling_price: 0, wholesale_price: 0 }

test('ملخص التحويلات: عدد القطع لكل اتجاه وشخص ونوع، وبيتبع الفلتر', () => {
  const c = categories.createCategory({ name: 'عود' })
  const oud = items.createItem({ category_id: c, name_ar: 'عود', stock: { new: { quantity: 50, purchase_price: 100, selling_price: 300, wholesale_price: 250 }, damaged: zero } })
  const shop = ws.createWorkspace({ partners: ['مصطفى', 'أحمد'] })
  const [mostafa, ahmed] = ws.listWorkspaces().find((w) => w.id === shop)!.partners.map((p) => p.id)
  const move = (kind: 'capital' | 'sale' | 'half', quantity: number, partner_id: number | null, date = '2026-05-01') =>
    transfers.createTransfer({ from_workspace_id: PERSONAL, to_workspace_id: shop, kind, partner_id, transfer_date: date, items: [{ item_id: oud, condition: 'new', quantity }] })

  move('capital', 5, mostafa)
  move('sale', 3, mostafa)
  move('capital', 2, ahmed)
  move('half', 4, null, '2026-06-01')
  const shopOud = withWorkspace(shop, () => items.listItems({}).find((i) => i.name_ar === 'عود')!.id)
  transfers.createTransfer({ from_workspace_id: shop, to_workspace_id: PERSONAL, kind: 'sale', partner_id: ahmed, items: [{ item_id: shopOud, condition: 'new', quantity: 1, unit_price: 400 }] })

  const rows = transfers.summarizeTransfers({})
  const pick = (direction: string, partner: number | null, kind: string) => rows.find((r) => r.direction === direction && r.partner_id === partner && r.kind === kind)
  assert.deepEqual([pick('out', mostafa, 'capital')?.pieces, pick('out', mostafa, 'sale')?.pieces, pick('out', ahmed, 'capital')?.pieces, pick('out', null, 'half')?.pieces], [5, 3, 2, 4])
  assert.deepEqual([pick('in', ahmed, 'sale')?.pieces, pick('in', ahmed, 'sale')?.total_price], [1, 400])
  assert.equal(pick('out', mostafa, 'capital')?.partner_name, 'مصطفى')

  // الفلتر: الفترة والنوع والبحث
  assert.deepEqual(transfers.summarizeTransfers({ from: '2026-06-01', to: '2026-06-30' }).map((r) => [r.kind, r.pieces]), [['half', 4]])
  assert.deepEqual(transfers.summarizeTransfers({ kind: 'capital' }).map((r) => r.pieces).sort(), [2, 5])
  assert.deepEqual(transfers.summarizeTransfers({ search: 'احمد' }).map((r) => [r.direction, r.pieces]).sort(), [['in', 1], ['out', 2]])

  // من جوه الشراكة: نفس القطع بالعكس
  const inside = withWorkspace(shop, () => transfers.summarizeTransfers({}))
  assert.equal(inside.filter((r) => r.direction === 'in').reduce((sum, r) => sum + r.pieces, 0), 14)
})
