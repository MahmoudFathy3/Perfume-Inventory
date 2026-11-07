import assert from 'node:assert/strict'
import test from 'node:test'
import * as categories from '../features/categories/categories.service'
import * as partners from '../features/partners/partners.service'
import * as purchases from '../features/purchases/purchases.service'
import * as returns from '../features/returns/returns.service'
import * as ws from '../features/workspaces/workspaces.service'
import { withWorkspace } from '../lib/workspace'
import { useTestDb } from './helpers'

useTestDb()

test('فاتورة شراء دفعها الشريك من جيبه: الشراكة عليها إجماليها ليه، والمرتجع بيقلّلها', () => {
  // المخزون الفعلي: العلامة بتتجاهل (مفيش شركاء)
  const personal = purchases.createPurchase({ supplier_name: 'مورد', paid_by_partner: true, items: [{ name_ar: 'مسك', category_id: categories.createCategory({ name: 'عطور' }), condition: 'new', quantity: 1, purchase_price: 10 }] })
  assert.equal(purchases.getPurchase({ id: personal })!.paid_by_partner, 0)

  const shop = ws.createWorkspace({ partners: ['مصطفى', 'أحمد'] })
  const [, ahmed] = ws.listWorkspaces().find((w) => w.id === shop)!.partners.map((p) => p.id)
  withWorkspace(shop, () => {
    const c = categories.createCategory({ name: 'عود' })
    const id = purchases.createPurchase({
      supplier_name: 'مورد',
      partner_id: ahmed,
      paid_by_partner: true,
      shipping_cost: 100,
      items: [{ name_ar: 'عود', category_id: c, condition: 'new', quantity: 4, purchase_price: 500 }]
    }) // 2000 + 100 شحن
    const purchase = purchases.getPurchase({ id })!
    assert.deepEqual([purchase.paid_by_partner, purchase.total], [1, 2100])

    const account = () => partners.ledger().accounts.find((a) => a.partner.id === ahmed)!
    assert.deepEqual([account().paid_out, account().sold], [2100, 0])
    assert.equal(account().balance, account().profit_share + 2100, 'داخلة في الباقي ليه')

    // مرتجع شراء (المورد رجّع فلوس قطعة): المستحق ليه بيقل
    returns.createReturn({ type: 'purchase', purchase_id: id, items: [{ item_id: purchase.items[0].item_id, condition: 'new', quantity: 1, unit_price: 525 }] })
    assert.equal(account().paid_out, 1575)

    // فاتورة عادية من فلوس الشراكة مبتتحسبش
    purchases.createPurchase({ supplier_name: 'مورد', partner_id: ahmed, items: [{ item_id: purchase.items[0].item_id, condition: 'new', quantity: 1, purchase_price: 500 }] })
    assert.equal(account().paid_out, 1575)
  })
})
