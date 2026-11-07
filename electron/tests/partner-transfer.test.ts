import assert from 'node:assert/strict'
import test from 'node:test'
import * as categories from '../features/categories/categories.service'
import * as partners from '../features/partners/partners.service'
import * as purchases from '../features/purchases/purchases.service'
import * as ws from '../features/workspaces/workspaces.service'
import { withWorkspace } from '../lib/workspace'
import { err, useTestDb } from './helpers'

useTestDb()

test('تسوية بين الشريكين: أحمد دفع 26,000 من جيبه، ومصطفى إدّاله نصه (13,000) فبقوا بالنص', () => {
  const shop = ws.createWorkspace({ partners: ['مصطفى', 'أحمد'] })
  const [mostafa, ahmed] = ws.listWorkspaces().find((w) => w.id === shop)!.partners.map((p) => p.id)
  withWorkspace(shop, () => {
    purchases.createPurchase({
      supplier_name: 'مورد',
      partner_id: ahmed,
      paid_by_partner: true,
      items: [{ name_ar: 'عود', category_id: categories.createCategory({ name: 'عود' }), condition: 'new', quantity: 26, purchase_price: 1000 }]
    })
    const balance = (id: number) => partners.ledger().accounts.find((a) => a.partner.id === id)!.balance
    const profit = partners.ledger().accounts[0].profit_share // نصيب كل واحد من الربح (واحد للاتنين)
    assert.deepEqual([balance(ahmed) - profit, balance(mostafa) - profit], [26000, 0])

    assert.equal(err(() => partners.transferBetweenPartners({ from_partner_id: mostafa, to_partner_id: mostafa, amount: 1 })), 'DUPLICATE_PARTNERS')
    assert.equal(err(() => partners.transferBetweenPartners({ from_partner_id: mostafa, to_partner_id: 99999, amount: 1 })), 'PARTNER_NOT_FOUND')

    const id = partners.transferBetweenPartners({ from_partner_id: mostafa, to_partner_id: ahmed, amount: 13000, notes: 'نصه في البضاعة' })
    assert.deepEqual([balance(ahmed) - profit, balance(mostafa) - profit], [13000, 13000], 'بالنص')
    const account = (pid: number) => partners.ledger().accounts.find((a) => a.partner.id === pid)!
    assert.deepEqual([account(ahmed).paid_out, account(mostafa).paid_out], [13000, 13000], 'كل واحد دفع من جيبه 13,000')
    assert.deepEqual([account(ahmed).settled, account(mostafa).settled], [0, 0], 'مش داخلة في اتدفع فعلًا')

    // في التسويات: سطرين مربوطين، كل واحد عارف التاني
    const pair = partners.ledger().payments.filter((p) => p.pair_id === id)
    assert.deepEqual(pair.map((p) => [p.partner_name, p.amount, p.counterparty_name, p.notes]).sort(), [['أحمد', 13000, 'مصطفى', 'نصه في البضاعة'], ['مصطفى', -13000, 'أحمد', 'نصه في البضاعة']].sort())

    // حذف أي واحد فيهم بيحذف الاتنين
    partners.removePayment({ id: pair[1].id })
    assert.equal(partners.ledger().payments.length, 0)
    assert.deepEqual([balance(ahmed) - profit, balance(mostafa) - profit], [26000, 0])
  })
})
