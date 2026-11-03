import assert from 'node:assert/strict'
import test from 'node:test'
import * as categories from '../features/categories/categories.service'
import * as partners from '../features/partners/partners.service'
import * as purchases from '../features/purchases/purchases.service'
import * as ws from '../features/workspaces/workspaces.service'
import { withWorkspace } from '../lib/workspace'
import { err, useTestDb } from './helpers'

useTestDb()

test('شراء الشريكين مع بعض: من غير شريك واحد، ومن جيبهم كل واحد بنسبته، وبيظهر في فلتر كل شريك', () => {
  const shop = ws.createWorkspace({ partners: ['محمود', 'أحمد'] })
  const [mahmoud, ahmed] = ws.listWorkspaces().find((w) => w.id === shop)!.partners.map((p) => p.id)
  withWorkspace(shop, () => {
    const cat = categories.createCategory({ name: 'عود' })
    const line = (name_ar: string, quantity: number) => ({ name_ar, category_id: cat, condition: 'new' as const, quantity, purchase_price: 100 })
    // من غير شريك ولا "مع بعض" بيترفض زي الأول
    assert.equal(err(() => purchases.createPurchase({ supplier_name: 'مورد', items: [line('عود', 1)] })), 'PARTNER_REQUIRED')

    const together = purchases.createPurchase({ supplier_name: 'مورد', joint: true, paid_by_partner: true, items: [line('عود', 10)] }) // 1000 من جيبهم
    const p = purchases.getPurchase({ id: together })!
    assert.deepEqual([p.joint, p.partner_id, p.paid, p.remaining, p.payments.length], [1, null, 1000, 0, 0])

    const paidOut = () => partners.ledger().accounts.map((a) => a.paid_out)
    assert.deepEqual(paidOut(), [500, 500])
    // كشف الحساب: نفس الرقم في الحركات
    const statement = partners.statement({ partner_id: mahmoud })
    assert.deepEqual(statement.lines.paid_out.map((l) => [l.ref_type, l.amount]), [['joint_purchase', 500]])

    // فاتورة لمحمود لوحده من جيبه + مع بعض من فلوس الشراكة (مش بتأثر على حسابهم)
    purchases.createPurchase({ supplier_name: 'مورد', partner_id: mahmoud, paid_by_partner: true, items: [line('روز', 2)] }) // 200
    purchases.createPurchase({ supplier_name: 'مورد', joint: true, paid: 0, items: [line('مسك', 3)] }) // 300 للمورد
    assert.deepEqual(paidOut(), [700, 500])

    // فلتر الشريك: فواتيره + اللي مع بعض
    const ids = (partnerId: number) => purchases.pagePurchases({ pageSize: 100, partnerId }).rows.length
    assert.deepEqual([ids(mahmoud), ids(ahmed)], [3, 2])
  })
})

test('في المخزون الفعلي "مع بعض" بيتجاهل (مفيش شركاء)', () => {
  const cat = categories.createCategory({ name: 'دخوني' })
  const id = purchases.createPurchase({ supplier_name: 'مورد', joint: true, paid_by_partner: true, items: [{ name_ar: 'خليفه', category_id: cat, condition: 'new', quantity: 1, purchase_price: 50 }] })
  const p = purchases.getPurchase({ id })!
  assert.deepEqual([p.joint, p.paid_by_partner, p.payments.length], [0, 0, 1])
})
