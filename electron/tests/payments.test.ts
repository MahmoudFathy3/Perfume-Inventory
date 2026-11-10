import assert from 'node:assert/strict'
import test from 'node:test'
import type { Condition } from '@shared/types'
import ExcelJS from 'exceljs'
import * as categories from '../features/categories/categories.service'
import * as customers from '../features/customers/customers.service'
import * as dashboard from '../features/dashboard/dashboard.service'
import * as items from '../features/items/items.service'
import * as payments from '../features/payments/payments.service'
import * as returns from '../features/returns/returns.service'
import * as sales from '../features/sales/sales.service'
import { buildExport, exportData } from '../features/export/export.service'
import { err, labels, one, stockOf, useTestDb } from './helpers'

useTestDb()
let catId = 0
test.before(() => {
  catId = categories.createCategory({ name: 'أدوات منزلية' })
})
const stock = (cond: Condition, id: number) => stockOf(id, cond)

test('الدفع الجزئي: المتبقي على العميل والتحصيل (الأقدم أولًا) وكشف الحساب', () => {
  const cust = customers.createCustomer({ name: 'عميل آجل', phone: '0100' })
  const paidUp = customers.createCustomer({ name: 'عميل مسدد' })
  const id = items.createItem({
    category_id: catId, name_ar: 'منتج الأجل',
    stock: { new: { quantity: 50, purchase_price: 100, selling_price: 200, wholesale_price: 0 }, damaged: { quantity: 0, purchase_price: 0, selling_price: 0, wholesale_price: 0 } }
  })
  const st = () => stock('new', id)
  const sell = (extra: object, quantity: number) => sales.createSale({ items: [{ item_id: id, condition: 'new', quantity, selling_price: 200 }], ...extra })

  const s1 = sell({ customer_id: cust, sale_date: '2026-04-01', paid: 1000 }, 10) // 2000: مدفوع 1000
  const s2 = sell({ customer_id: cust, sale_date: '2026-04-05', paid: 0 }, 5)     // 1000: مدفوع 0
  const cash = sell({}, 1)                                                          // كاش: مدفوع كله
  sell({ customer_id: paidUp }, 1)
  const get = (sid: number) => sales.getSale({ id: sid })!
  assert.deepEqual([get(s1).paid, get(s1).remaining, get(s1).payments.length], [1000, 1000, 1])
  assert.deepEqual([get(s2).paid, get(s2).remaining, get(s2).payments.length], [0, 1000, 0])
  assert.deepEqual([get(cash).paid, get(cash).remaining, get(cash).customer_id], [200, 0, null])

  // أخطاء: متبقي من غير عميل، أو مدفوع أكبر من الإجمالي، أو عميل مش موجود (ومفيش حاجة بتتحفظ)
  assert.equal(err(() => sell({ paid: 100 }, 1)), 'CUSTOMER_REQUIRED')
  assert.equal(err(() => sell({ customer_id: cust, paid: 99999 }, 1)), 'PAID_EXCEEDS_TOTAL')
  assert.equal(err(() => sell({ customer_id: 99999 }, 1)), 'CUSTOMER_NOT_FOUND')
  assert.equal(st().quantity, 50 - 10 - 5 - 1 - 1)

  // قايمة العملاء: عليهم فلوس بس
  const row = customers.listCustomers({}).find((c) => c.id === cust)!
  assert.deepEqual([row.sales_count, row.total, row.paid, row.remaining], [2, 3000, 1000, 2000])
  const owing = customers.listCustomers({ owing: true }).map((c) => c.id)
  assert.ok(owing.includes(cust) && !owing.includes(paidUp))
  assert.equal(customers.listCustomers({ search: 'اجل' }).length, 1)

  // تحصيل 1500 على العميل: بيقفل الأقدم (1000) وبعدها 500 من الفاتورة التانية
  const ids = payments.collect({ customer_id: cust, amount: 1500, payment_date: '2026-04-10', notes: 'دفعة' })
  assert.equal(ids.length, 2)
  assert.deepEqual([get(s1).paid, get(s1).remaining, get(s2).paid, get(s2).remaining], [2000, 0, 500, 500])
  assert.equal(err(() => payments.collect({ customer_id: cust, amount: 600 })), 'PAYMENT_EXCEEDS_REMAINING')
  assert.equal(err(() => payments.collect({ customer_id: cust, amount: 0 })), 'INVALID_AMOUNT')
  assert.equal(err(() => payments.collect({ sale_id: s2, amount: 501 })), 'PAYMENT_EXCEEDS_REMAINING')

  // تحصيل على فاتورة بعينها، وبعد ما تتقفل مفيش حاجة مستحقة
  const lastPayment = payments.collect({ sale_id: s2, amount: 500, payment_date: '2026-04-12' })[0]
  assert.equal(get(s2).remaining, 0)
  assert.equal(err(() => payments.collect({ sale_id: s2, amount: 1 })), 'NOTHING_DUE')
  assert.equal(err(() => payments.collect({ customer_id: cust, amount: 1 })), 'NOTHING_DUE')

  // كشف الحساب والرئيسية
  const statement = customers.getStatement({ id: cust })
  assert.deepEqual(statement.totals, { total: 3000, paid: 3000, returns: 0, remaining: 0, credit: 0, refunded: 0 })
  assert.deepEqual([statement.sales.length, statement.payments.length], [2, 4])
  const april = dashboard.summary({ from: '2026-04-01', to: '2026-04-30' })
  assert.equal(april.collected, 3000)
  assert.equal(april.receivables, 0)
  assert.equal(err(() => customers.getStatement({ id: 99999 })), 'CUSTOMER_NOT_FOUND')

  // حذف دفعة اتسجلت بالغلط: المتبقي بيرجع
  payments.removePayment({ id: lastPayment })
  assert.equal(get(s2).remaining, 500)
  assert.equal(dashboard.summary().receivables, 500)

  // مرتجع بيع بيقلل المتبقي (1000 - 200 مرتجع - 500 مدفوع = 300) وبيمنع تعديل الفاتورة لحد ما يتحذف
  const rid = returns.createReturn({ type: 'sale', sale_id: s2, items: [{ item_id: id, condition: 'new', quantity: 1, unit_price: 200 }] })
  assert.deepEqual([get(s2).returns_total, get(s2).remaining], [200, 300])
  assert.equal(customers.listCustomers({}).find((c) => c.id === cust)!.remaining, 300)
  assert.equal(err(() => sales.updateSale({ id: s2, customer_id: cust, items: [{ item_id: id, condition: 'new', quantity: 1 }] })), 'HAS_RETURNS')
  assert.equal(err(() => sales.removeSale({ id: s2 })), 'HAS_RETURNS')
  returns.removeReturn({ id: rid })
  assert.equal(get(s2).remaining, 500)

  // تقليل الفاتورة لأقل من المدفوع بيترفض، والعميل لازم يفضل (فيه متبقي)
  const before = st().quantity
  assert.equal(err(() => sales.updateSale({ id: s2, customer_id: cust, items: [{ item_id: id, condition: 'new', quantity: 1, selling_price: 200 }] })), 'TOTAL_BELOW_PAID')
  assert.equal(err(() => sales.updateSale({ id: s2, items: [{ item_id: id, condition: 'new', quantity: 5, selling_price: 200 }] })), 'CUSTOMER_REQUIRED')
  assert.equal(st().quantity, before)

  // حذف الفاتورة بيمسح دفعاتها وبيرجّع الكمية، والعميل اللي ليه فواتير مينفعش يتحذف
  sales.removeSale({ id: s2 })
  assert.equal(st().quantity, before + 5)
  assert.equal(one<{ c: number }>('SELECT COUNT(*) c FROM sale_payments WHERE sale_id = ?', s2).c, 0)
  assert.equal(err(() => customers.removeCustomer({ id: cust })), 'SQLITE_CONSTRAINT_FOREIGNKEY')
  customers.updateCustomer({ id: cust, name: 'عميل آجل (معدل)', phone: '' })
  assert.deepEqual(customers.getStatement({ id: cust }).customer, { id: cust, name: 'عميل آجل (معدل)', phone: null, is_partner: 0 })
})

// ============================================================
// حذف المرتجعات
// ============================================================

test('تصدير العملاء والدفعات، والمبيعات فيها المدفوع والمتبقي', async () => {
  const sheets = exportData({ dataset: 'customers' })
  assert.deepEqual(sheets.map((x) => x.key), ['customers', 'payments'])
  const cust = sheets[0].rows.find((r) => r.name === 'عميل آجل (معدل)')!
  assert.ok(cust && cust.remaining === 0 && Number(cust.paid) > 0)
  assert.ok(sheets[1].rows.length >= 3 && sheets[1].rows.every((r) => r.customer))

  const sale = exportData({ dataset: 'sales' })[0]
  assert.ok(['paid', 'remaining'].every((k) => sale.columns.some((c) => c.key === k)))
  assert.ok(sale.rows.some((r) => r.customer === 'عميل آجل (معدل)' && r.paid === 2000))

  const built = await buildExport({ dataset: 'customers', format: 'xlsx', labels, rtl: true })
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(built.data as unknown as ArrayBuffer)
  assert.deepEqual(wb.worksheets.map((w) => w.name), ['العملاء', 'الدفعات'])
})

// ============================================================
// الداتا بيز
// ============================================================
