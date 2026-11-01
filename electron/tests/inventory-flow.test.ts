// سيناريو واحد متتابع: الاختبارات هنا بتبني على بعض (مشتريات ثم مبيعات ثم مرتجعات ثم الرئيسية والتصدير) على نفس الداتا بيز،
// فلازم تفضل بالترتيب. أي اختبار مستقل بذاته مكانه ملف منفصل جنبه (invoices-edit, payments, returns, ...).
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import ExcelJS from 'exceljs'
import type { Condition } from '@shared/types'
import { closeDb, getDb, openDb } from '../database/connection'
import { migrate } from '../database/migrate'
import * as backup from '../features/backup/backup.service'
import * as categories from '../features/categories/categories.service'
import * as customers from '../features/customers/customers.service'
import * as dashboard from '../features/dashboard/dashboard.service'
import { buildExport, exportData } from '../features/export/export.service'
import * as items from '../features/items/items.service'
import * as purchases from '../features/purchases/purchases.service'
import * as returns from '../features/returns/returns.service'
import * as sales from '../features/sales/sales.service'
import * as settings from '../features/settings/settings.service'
import { labels } from './helpers'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'inv-'))
const dbFile = path.join(tmp, 'inventory.sqlite')
let itemId = 0
let catId = 0
let customerId = 0

test.before(() => {
  openDb(dbFile)
  migrate(getDb())
  catId = categories.createCategory({ name: 'أدوات منزلية' })
  itemId = items.createItem({ category_id: catId, name_ar: 'كوباية زجاج', name_en: 'Glass cup' })
  customerId = customers.createCustomer({ name: 'أحمد' })
})
test.after(() => {
  closeDb()
  fs.rmSync(tmp, { recursive: true, force: true })
})

interface StockRow {
  quantity: number
  purchase_price: number
  selling_price: number
  wholesale_price: number
}
const stock = (cond: Condition, id = itemId) =>
  getDb().prepare('SELECT * FROM item_stock WHERE item_id = ? AND condition = ?').get(id, cond) as StockRow
const err = (fn: () => unknown): string | undefined => {
  try {
    fn()
  } catch (e) {
    return (e as { code?: string }).code
  }
  return undefined
}
const round = (n: number) => Math.round(n * 100) / 100
const one = <T>(sql: string, ...params: unknown[]) => getDb().prepare(sql).get(...params) as T

test('الشراء: الشحن بيتوزع ويدخل في التكلفة والمخزون وسعر الجملة', () => {
  purchases.createPurchase({
    supplier_name: 'مورد أ', shipping_cost: 100, notes: 'شحنة أولى',
    items: [
      { item_id: itemId, condition: 'new', quantity: 40, purchase_price: 50, selling_price: 80, wholesale_price: 70 },
      { item_id: itemId, condition: 'damaged', quantity: 10, purchase_price: 20, selling_price: 35, wholesale_price: 28 }
    ]
  })
  assert.equal(stock('new').quantity, 40)
  assert.equal(stock('damaged').quantity, 10)
  assert.equal(stock('new').purchase_price, 52.2727) // 50 + 90.909/40
  assert.equal(stock('damaged').purchase_price, 20.9091)
  assert.equal(stock('new').selling_price, 80)
  assert.equal(stock('new').wholesale_price, 70)
  assert.equal(stock('damaged').wholesale_price, 28)
  assert.equal(one<{ total: number }>('SELECT * FROM purchases').total, 2300)
})

test('البيع: شحن العميل بيتضاف للإجمالي، والتالف بسعره، والمخزون بيقل', () => {
  sales.createSale({
    customer_id: customerId, shipping_cost: 30,
    items: [
      { item_id: itemId, condition: 'new', quantity: 5 },
      { item_id: itemId, condition: 'damaged', quantity: 2, selling_price: 30 }
    ]
  })
  assert.equal(stock('new').quantity, 35)
  assert.equal(stock('damaged').quantity, 8)
  const s = one<{ total: number; price_type: string }>('SELECT * FROM sales')
  assert.equal(s.total, 5 * 80 + 2 * 30 + 30)
  assert.equal(s.price_type, 'retail')
  assert.equal(one<{ purchase_price: number }>("SELECT * FROM sale_items WHERE condition = 'new'").purchase_price, 52.2727)
})

test('بيع بسعر الجملة: السعر الافتراضي من سعر الجملة، ولو مش متحدد بيرجع للقطاعي', () => {
  const id = sales.createSale({ price_type: 'wholesale', items: [{ item_id: itemId, condition: 'new', quantity: 1 }] })
  assert.equal(one<{ p: string }>('SELECT price_type p FROM sales WHERE id = ?', id).p, 'wholesale')
  assert.equal(one<{ s: number }>('SELECT selling_price s FROM sale_items WHERE sale_id = ?', id).s, 70)
  returns.createReturn({ type: 'sale', sale_id: id, items: [{ item_id: itemId, condition: 'new', quantity: 1, unit_price: 70 }] })

  const other = items.createItem({ category_id: catId, name_ar: 'صنف من غير جملة', stock: { new: { quantity: 5, purchase_price: 10, selling_price: 25, wholesale_price: 0 }, damaged: { quantity: 0, purchase_price: 0, selling_price: 0, wholesale_price: 0 } } })
  const id2 = sales.createSale({ price_type: 'wholesale', items: [{ item_id: other, condition: 'new', quantity: 1 }] })
  assert.equal(one<{ s: number }>('SELECT selling_price s FROM sale_items WHERE sale_id = ?', id2).s, 25)
})

test('البيع بكمية أكبر من المتاحة بيترفض ومفيش حاجة بتتحفظ', () => {
  const before = one<{ c: number }>('SELECT COUNT(*) c FROM sales').c
  assert.equal(err(() => sales.createSale({ items: [{ item_id: itemId, condition: 'new', quantity: 999 }] })), 'OUT_OF_STOCK')
  assert.equal(one<{ c: number }>('SELECT COUNT(*) c FROM sales').c, before)
})

test('مرتجع بيع: القطع ترجع بحالتها، ومينفعش يزيد عن اللي اتباع', () => {
  const saleId = one<{ id: number }>('SELECT id FROM sales ORDER BY id LIMIT 1').id
  returns.createReturn({ type: 'sale', sale_id: saleId, reason: 'عيب', items: [{ item_id: itemId, condition: 'damaged', quantity: 1, unit_price: 80 }] })
  assert.equal(stock('damaged').quantity, 9)
  assert.equal(err(() => returns.createReturn({ type: 'sale', sale_id: saleId, items: [{ item_id: itemId, condition: 'new', quantity: 50, unit_price: 80 }] })), 'RETURN_EXCEEDS')
})

test('مرتجع شراء: القطع بتخرج من المخزن', () => {
  const pid = one<{ id: number }>('SELECT id FROM purchases ORDER BY id LIMIT 1').id
  returns.createReturn({ type: 'purchase', purchase_id: pid, items: [{ item_id: itemId, condition: 'new', quantity: 5, unit_price: 50 }] })
  assert.equal(stock('new').quantity, 30)
})

test('تعديل السعر يدويًا على المخزون (شامل الجملة)', () => {
  items.updatePrices({ id: itemId, condition: 'new', selling_price: 90, wholesale_price: 75 })
  assert.equal(stock('new').selling_price, 90)
  assert.equal(stock('new').wholesale_price, 75)
  assert.equal(stock('new').purchase_price, 52.2727)
  items.updatePrices({ id: itemId, condition: 'new', selling_price: 80, wholesale_price: 70 })
})

test('الرئيسية: القطع ورأس المال (قيمة المخزون بسعر التكلفة)', () => {
  const d = dashboard.summary()
  assert.equal(d.stock.new_pieces, 34) // 30 كوباية + 4 من منتج اختبار الجملة
  assert.equal(d.stock.damaged_pieces, 9)
  assert.equal(d.purchases.total, 2300)
  assert.equal(d.purchases.shipping, 100)
  assert.equal(d.counts.categories, 1)

  // رأس المال = مجموع (الكمية × التكلفة) لكل المنتجات، مقسوم جديد / تالف
  const all = items.listItems({})
  const expectedNew = all.reduce((s, i) => s + i.new_quantity * i.new_purchase_price, 0)
  const expectedDamaged = all.reduce((s, i) => s + i.damaged_quantity * i.damaged_purchase_price, 0)
  assert.ok(Math.abs(d.stock.new_cost_value - expectedNew) < 0.01)
  assert.ok(Math.abs(d.stock.damaged_cost_value - expectedDamaged) < 0.01)
  assert.ok(Math.abs(d.stock.cost_value - (expectedNew + expectedDamaged)) < 0.02)
  assert.ok(d.stock.cost_value > 0)
})

test('البحث العربي بيتجاهل الهمزة والتاء المربوطة', () => {
  assert.equal(items.listItems({ search: 'كوبايه' }).length, 1)
  assert.equal(items.listItems({ search: 'glass' }).length, 1)
  assert.equal(items.listItems({ search: 'مش موجود' }).length, 0)
  assert.equal(items.listItems({ search: 'ادوات' }).length, 2)
  assert.equal(categories.listCategories({ search: 'ادوات' }).length, 1)
  assert.equal(purchases.listPurchases({ search: 'مورد ا' }).length, 1)
  assert.equal(sales.listSales({ search: 'احمد' }).length, 1)
  assert.equal(returns.listReturns({ search: 'عيب' }).length, 1)
})

test('المنتج بيتحفظ بالمخزون والأسعار في فورم واحد (إنشاء وتعديل)', () => {
  const id = items.createItem({
    category_id: catId, name_ar: 'طبق', name_en: 'Plate',
    stock: { new: { quantity: 12, purchase_price: 10, selling_price: 18, wholesale_price: 15 }, damaged: { quantity: 3, purchase_price: 4, selling_price: 7, wholesale_price: 5 } }
  })
  let row = items.getItem({ id })!
  assert.equal(row.new_quantity, 12)
  assert.equal(row.new_wholesale_price, 15)
  assert.equal(row.damaged_wholesale_price, 5)
  assert.equal(row.category_name, 'أدوات منزلية')

  items.updateItem({ id, category_id: catId, name_ar: 'طبق كبير', name_en: 'Big plate',
    stock: { new: { quantity: 20, purchase_price: 11, selling_price: 20, wholesale_price: 17 }, damaged: { quantity: 0, purchase_price: 0, selling_price: 0, wholesale_price: 0 } } })
  row = items.getItem({ id })!
  assert.equal(row.name_ar, 'طبق كبير')
  assert.equal(row.new_quantity, 20)
  assert.equal(row.new_wholesale_price, 17)

  assert.equal(err(() => items.createItem({ category_id: catId, name_ar: 'س', stock: { new: { quantity: -1, purchase_price: 0, selling_price: 0, wholesale_price: 0 }, damaged: { quantity: 0, purchase_price: 0, selling_price: 0, wholesale_price: 0 } } })), 'INVALID_QUANTITY')
  assert.equal(err(() => items.createItem({ name_ar: 'س' })), 'CATEGORY_REQUIRED')
  assert.deepEqual(items.removeItem({ id }), { mode: 'deleted' }) // ملوش حركات = حذف نهائي
  assert.equal(items.getItem({ id }), undefined)
})

test('حذف منتج مرتبط بفواتير = أرشفة (بيتخفي والفواتير بتفضل كاملة)', () => {
  const id = items.createItem({ category_id: catId, name_ar: 'منتج للأرشفة', name_en: 'Archive me' })
  purchases.createPurchase({ supplier_name: 'مورد ج', items: [{ item_id: id, condition: 'new', quantity: 7, purchase_price: 10, selling_price: 15 }] })
  sales.createSale({ items: [{ item_id: id, condition: 'new', quantity: 2 }] })
  const before = dashboard.summary()
  assert.equal(items.listItems({ search: 'للأرشفة' }).length, 1)

  assert.deepEqual(items.removeItem({ id }), { mode: 'archived' })

  assert.equal(items.listItems({ search: 'للأرشفة' }).length, 0)                // مش بيظهر في القوائم
  const after = dashboard.summary()
  assert.equal(after.stock.pieces, before.stock.pieces - 5)                     // الـ 5 قطع اللي فاضلة اتشالت من المخزون
  assert.ok(Math.abs(after.stock.cost_value - (before.stock.cost_value - 50)) < 0.01) // ورأس المال
  assert.equal(after.counts.items, before.counts.items - 1)
  assert.equal(categories.listCategories({}).find((c) => c.id === catId)!.items_count, before.counts.items - 1)

  const row = items.getItem({ id })!                                             // التفاصيل والتاريخ لسه موجودين
  assert.ok(row.deleted_at)
  assert.equal(items.getDetails({ id }).movements.length, 2)
  assert.equal(one<{ c: number }>('SELECT COUNT(*) c FROM purchase_items WHERE item_id = ?', id).c, 1)
  assert.equal(exportData({ dataset: 'items' })[0].rows.some((r) => r.name_ar === 'منتج للأرشفة'), false)

  // مينفعش يتباع أو يتشترى تاني، لكن ينفع نعمل منتج جديد بنفس الاسم
  assert.equal(err(() => sales.createSale({ items: [{ item_id: id, condition: 'new', quantity: 1 }] })), 'ITEM_NOT_FOUND')
  assert.equal(err(() => purchases.createPurchase({ supplier_name: 'م', items: [{ item_id: id, condition: 'new', quantity: 1, purchase_price: 1 }] })), 'ITEM_NOT_FOUND')
  const again = items.createItem({ category_id: catId, name_ar: 'منتج للأرشفة' })
  assert.notEqual(again, id)
  items.removeItem({ id: again })
})

test('الحذف بيترفض لو الصنف مستخدم', () => {
  assert.equal(err(() => categories.removeCategory({ id: catId })), 'SQLITE_CONSTRAINT_FOREIGNKEY') // الـ IPC بيحوّله لـ IN_USE
})

test('التصدير والاستيراد (نسخة احتياطية)', async () => {
  settings.set({ key: 'language', value: 'en' })
  const out = path.join(tmp, 'backup.sqlite')
  backup.exportTo(out, dbFile)
  settings.set({ key: 'language', value: 'ar' })
  assert.equal(err(() => backup.validateDbFile(path.join(tmp, 'nope.sqlite'))), 'INVALID_BACKUP_FILE')

  const piecesBefore = dashboard.summary().stock.pieces
  backup.importFrom(out, dbFile)
  assert.equal(settings.get({ key: 'language' }), 'en')
  assert.ok(fs.readdirSync(tmp).some((f) => f.startsWith('before-import-')))
  assert.equal(dashboard.summary().stock.pieces, piecesBefore)
})

test('نقل الداتا بيز لفولدر تاني', () => {
  const next = path.join(tmp, 'moved', 'inventory.sqlite')
  const pieces = dashboard.summary().stock.pieces
  backup.moveDatabase(dbFile, next)
  assert.ok(fs.existsSync(next))
  assert.equal(dashboard.summary().stock.pieces, pieces)
  assert.equal(err(() => backup.moveDatabase(dbFile, next)), 'TARGET_EXISTS')
})

test('فاتورة الشراء بتعمل منتج جديد بصنفه، ومينفعش باسم منتج موجود', () => {
  const kitchen = categories.createCategory({ name: 'أدوات المطبخ' })
  const before = one<{ c: number }>('SELECT COUNT(*) c FROM items').c
  purchases.createPurchase({
    supplier_name: 'مورد ب',
    items: [{ name_ar: 'ملعقة', name_en: 'Spoon', category_id: kitchen, condition: 'new', quantity: 10, purchase_price: 5, selling_price: 9, wholesale_price: 7 }]
  })
  assert.equal(one<{ c: number }>('SELECT COUNT(*) c FROM items').c, before + 1)
  const spoon = items.listItems({ search: 'ملعقه' })[0]
  assert.equal(spoon.category_name, 'أدوات المطبخ')
  assert.equal(spoon.new_quantity, 10)
  assert.equal(spoon.new_selling_price, 9)
  assert.equal(spoon.new_wholesale_price, 7)

  // نفس الاسم (حتى لو بتاء/همزة مختلفة) بيترفض ومفيش حاجة بتتحفظ
  const lines = (name: string) => [{ name_ar: name, category_id: kitchen, condition: 'new' as const, quantity: 5, purchase_price: 6 }]
  assert.equal(err(() => purchases.createPurchase({ supplier_name: 'مورد ب', items: lines('ملعقه') })), 'DUPLICATE_NAME')
  assert.equal(items.listItems({ search: 'ملعقه' })[0].new_quantity, 10)

  assert.equal(err(() => purchases.createPurchase({ supplier_name: 'م', items: [{ name_ar: 'شوكة', condition: 'new', quantity: 1, purchase_price: 1 }] })), 'CATEGORY_REQUIRED')
  assert.equal(items.listItems({ search: 'شوكة' }).length, 0)
})

test('المتوسط المرجّح: شراء بـ 50 ثم بـ 100', () => {
  const id = items.createItem({ category_id: catId, name_ar: 'كوب متوسط' })
  const buy = (quantity: number, price: number) => purchases.createPurchase({ supplier_name: 'م', items: [{ item_id: id, condition: 'new', quantity, purchase_price: price, selling_price: 150 }] })
  const st = () => stock('new', id)

  buy(40, 50)
  assert.equal(st().purchase_price, 50)
  buy(40, 100)
  assert.equal(st().quantity, 80)
  assert.equal(st().purchase_price, 75)

  const saleId = sales.createSale({ items: [{ item_id: id, condition: 'new', quantity: 30, selling_price: 150 }] })
  assert.equal(one<{ p: number }>('SELECT purchase_price p FROM sale_items WHERE sale_id = ?', saleId).p, 75)
  assert.equal(st().purchase_price, 75)
  assert.equal(st().quantity, 50)

  buy(50, 120)
  assert.equal(st().purchase_price, 97.5)

  returns.createReturn({ type: 'sale', sale_id: saleId, items: [{ item_id: id, condition: 'new', quantity: 10, unit_price: 150 }] })
  assert.equal(st().quantity, 110)
  assert.equal(st().purchase_price, 95.4545)

  const pid = one<{ m: number }>('SELECT MAX(id) m FROM purchases').m
  returns.createReturn({ type: 'purchase', purchase_id: pid, items: [{ item_id: id, condition: 'new', quantity: 20, unit_price: 120 }] })
  assert.equal(st().quantity, 90)
  assert.ok(Math.abs(st().purchase_price - 90) < 0.001)
})

test('الرئيسية: فلتر التاريخ، بيانات الرسوم، ومقارنة الربح بالفترة السابقة', () => {
  const all = dashboard.summary()
  const none = dashboard.summary({ from: '2000-01-01', to: '2000-01-31' })
  assert.equal(none.purchases.total, 0)
  assert.equal(none.sales.products, 0)
  assert.equal(none.profit, 0)
  assert.equal(none.stock.pieces, all.stock.pieces)
  assert.ok(all.charts.series.length >= 1)
  assert.ok(all.charts.top.length >= 1 && all.charts.top.length <= 5)
  assert.equal(all.profit_previous, null)

  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  const day = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
  const one1 = dashboard.summary({ from: day, to: day })
  assert.ok(one1.sales.count >= 1)
  const prevDay = new Date(new Date(`${day}T00:00:00Z`).getTime() - 86400000).toISOString().slice(0, 10)
  assert.equal(one1.profit_previous?.to, prevDay)
  assert.equal(one1.profit_previous?.from, prevDay)

  const week = dashboard.summary({ from: '2026-10-08', to: '2026-10-14' })
  assert.deepEqual([week.profit_previous?.from, week.profit_previous?.to], ['2026-10-01', '2026-10-07'])
})

test('تفاصيل المنتج: كل الحركات والملخص', () => {
  const d = items.getDetails({ id: itemId })
  const types = new Set(d.movements.map((m) => m.type))
  assert.ok(['purchase', 'sale', 'sale_return', 'purchase_return'].every((t) => types.has(t as never)))
  assert.equal(d.totals.purchased_qty, 50)
  assert.equal(d.totals.purchase_returns_qty, 5)
  for (const cond of ['new', 'damaged'] as const) {
    const net = d.movements.filter((m) => m.condition === cond).reduce((a, m) => a + m.direction * m.quantity, 0)
    assert.equal(d.item[`${cond}_quantity`], net + d.adjustments[cond])
  }
  assert.equal(d.adjustments.new, 0)
  assert.equal(d.adjustments.damaged, 0)
  const dates = d.movements.map((m) => m.date)
  assert.deepEqual(dates, [...dates].sort().reverse())
  assert.equal(err(() => items.getDetails({ id: 99999 })), 'ITEM_NOT_FOUND')
})

test('شحن البيع: على العميل بيتضاف للفاتورة، وعلى المحل مصروف بيتخصم من الربح', () => {
  const id = items.createItem({ category_id: catId, name_ar: 'منتج الشحن', stock: { new: { quantity: 20, purchase_price: 100, selling_price: 150, wholesale_price: 0 }, damaged: { quantity: 0, purchase_price: 0, selling_price: 0, wholesale_price: 0 } } })
  const day = '2026-03-05'
  const before = dashboard.summary({ from: day, to: day })

  const onCustomer = sales.createSale({ sale_date: day, shipping_cost: 40, shipping_payer: 'customer', items: [{ item_id: id, condition: 'new', quantity: 2 }] })
  const onShop = sales.createSale({ sale_date: day, shipping_cost: 25, shipping_payer: 'shop', items: [{ item_id: id, condition: 'new', quantity: 2 }] })
  const defaulted = sales.createSale({ sale_date: day, shipping_cost: 10, items: [{ item_id: id, condition: 'new', quantity: 1 }] })

  const total = (sid: number) => one<{ total: number; shipping_payer: string }>('SELECT total, shipping_payer FROM sales WHERE id = ?', sid)
  assert.deepEqual(total(onCustomer), { total: 300 + 40, shipping_payer: 'customer' }) // الشحن اتضاف
  assert.deepEqual(total(onShop), { total: 300, shipping_payer: 'shop' })               // الشحن مش في الفاتورة
  assert.deepEqual(total(defaulted), { total: 150 + 10, shipping_payer: 'customer' })   // الافتراضي: على العميل

  const after = dashboard.summary({ from: day, to: day })
  assert.equal(round(after.sales.products - before.sales.products), 300 + 300 + 150)    // مبيعات الأصناف من غير شحن العميل
  assert.equal(round(after.sales.shipping - before.sales.shipping), 40 + 10)            // شحن العميل
  assert.equal(round(after.sales.shop_shipping - before.sales.shop_shipping), 25)       // شحن المحل
  // الربح: (2+2+1) × 50 = 250، ناقص 25 شحن على المحل
  assert.equal(round(after.profit - before.profit), 250 - 25)
  const point = after.charts.series.find((p) => p.period === day)!
  assert.equal(round(point.profit), round(before.charts.series.find((p) => p.period === day)?.profit ?? 0) + 225)

  // التصدير: الإجمالي والربح بنفس الحسابات
  const rows = exportData({ dataset: 'sales' })[0].rows
  const shopRow = rows.find((r) => r.id === onShop)!
  assert.equal(shopRow.shipping_payer, 'shop')
  assert.equal(shopRow.subtotal, 300)
  assert.equal(shopRow.total, 300)
  assert.equal(shopRow.profit, 100 - 25)
  assert.equal(rows.find((r) => r.id === onCustomer)!.profit, 100)
})

// ---------- التصدير إلى Excel / CSV ----------

test('تصدير Excel: شيتين للمشتريات بعناوين عربي واتجاه RTL وأرقام وتواريخ حقيقية', async () => {
  const built = await buildExport({ dataset: 'purchases', format: 'xlsx', labels, rtl: true })
  assert.equal(built.ext, 'xlsx')
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(built.data as unknown as ArrayBuffer)
  assert.deepEqual(wb.worksheets.map((w) => w.name), ['المشتريات', 'تفاصيل المشتريات'])

  const main = wb.getWorksheet('المشتريات')!
  assert.equal(main.getRow(1).getCell(3).value, 'المورد')
  assert.equal(main.views[0].rightToLeft, true)
  assert.ok(main.rowCount >= 2)
  assert.ok(main.getRow(2).getCell(2).value instanceof Date)               // تاريخ حقيقي
  assert.equal(typeof main.getRow(2).getCell(8).value, 'number')           // الإجمالي رقم

  const lines = wb.getWorksheet('تفاصيل المشتريات')!
  const conditions = new Set<unknown>()
  lines.eachRow((row, n) => n > 1 && conditions.add(row.getCell(7).value))
  assert.ok([...conditions].every((c) => c === 'جديد' || c === 'تالف'))   // الحالة مترجمة
})

test('تصدير CSV: كل الجداول في ملف واحد بـ BOM وعناوين مترجمة، والبحث بيقلل الصفوف', async () => {
  const all = await buildExport({ dataset: 'purchases', format: 'csv', labels })
  const text = all.data as string
  assert.equal(all.ext, 'csv')
  assert.ok(text.startsWith('\uFEFF'))
  const lines = text.replace('\uFEFF', '').split('\r\n')
  assert.equal(lines[0], 'المشتريات')                                   // عنوان الجدول الأول
  assert.equal(lines[1].split(',')[2], 'المورد')                       // عناوين الأعمدة
  assert.ok(lines.includes('تفاصيل المشتريات'))                         // وجدول التفاصيل في نفس الملف

  const filtered = await buildExport({ dataset: 'purchases', format: 'csv', labels, search: 'مورد ج' })
  assert.ok((filtered.data as string).split('\r\n').length < text.split('\r\n').length)
  const none = await buildExport({ dataset: 'purchases', format: 'csv', labels, search: 'مش موجود' })
  assert.ok(!(none.data as string).includes('مورد ب'))                  // مفيش فواتير بس العناوين
})

test('تصدير كل الجداول: المنتجات والأصناف والمبيعات والمرتجعات وحركات المنتج', async () => {
  for (const dataset of ['items', 'categories', 'sales', 'returns'] as const) {
    const built = await buildExport({ dataset, format: 'xlsx', labels })
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(built.data as unknown as ArrayBuffer)
    assert.ok(wb.worksheets.length >= 1 && wb.worksheets[0].rowCount >= 2, dataset)
  }
  assert.equal(exportData({ dataset: 'movements' })[2].rows.length, 0) // من غير منتج = جدول الحركات فاضي
})

test('تصدير تفاصيل المنتج: بياناته وملخصه وكل حركاته', async () => {
  const sheets = exportData({ dataset: 'movements', itemId })
  assert.deepEqual(sheets.map((x) => x.key), ['product', 'summary', 'movements'])

  const product = sheets[0].rows[0]
  assert.equal(product.name_ar, 'كوباية زجاج')
  assert.equal(product.name_en, 'Glass cup')
  assert.equal(product.category, 'أدوات منزلية')
  assert.equal(product.status, 'active')
  assert.equal(product.total_quantity, Number(product.new_quantity) + Number(product.damaged_quantity))
  assert.ok(Number(product.stock_value) > 0)

  const summary = sheets[1].rows[0]
  const details = items.getDetails({ id: itemId })
  assert.equal(summary.purchased_qty, details.totals.purchased_qty)
  assert.equal(summary.profit, details.totals.profit)

  const movements = sheets[2].rows
  assert.equal(movements.length, details.movements.length)
  assert.ok(movements.some((r) => Number(r.quantity) < 0))                       // الخارج بعلامة سالب
  assert.ok(movements.filter((r) => r.type === 'sale').every((r) => r.profit !== null)) // ربح البيع

  const built = await buildExport({ dataset: 'movements', itemId, format: 'xlsx', labels, rtl: true })
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(built.data as unknown as ArrayBuffer)
  assert.deepEqual(wb.worksheets.map((w) => w.name), ['بيانات المنتج', 'ملخص المنتج', 'الحركات'])
  const rec = wb.getWorksheet('بيانات المنتج')!
  assert.equal(rec.getRow(1).getCell(1).value, 'البند')                           // شكل (البند | القيمة)
  assert.equal(rec.getRow(2).getCell(1).value, 'الحالة العامة')
  assert.equal(rec.getRow(2).getCell(2).value, 'نشط')

  const csv = (await buildExport({ dataset: 'movements', itemId, format: 'csv', labels })).data as string
  assert.ok(csv.includes('بيانات المنتج') && csv.includes('ملخص المنتج') && csv.includes('كوباية زجاج'))
})

test('كل dataset بيصدّر الجدول وتفاصيله (شيتين على الأقل) وفيها كل الأعمدة المهمة', () => {
  const keys = (dataset: Parameters<typeof exportData>[0]['dataset']) => exportData({ dataset }).map((x) => x.key)
  assert.deepEqual(keys('categories'), ['categories', 'category_items'])
  assert.deepEqual(keys('items'), ['items', 'item_movements'])
  assert.deepEqual(keys('purchases'), ['purchases', 'purchase_items'])
  assert.deepEqual(keys('sales'), ['sales', 'sale_items'])
  assert.deepEqual(keys('returns'), ['returns', 'return_items'])

  const cats = exportData({ dataset: 'categories' })
  assert.ok(cats[0].rows[0].stock_value !== undefined && cats[1].rows.length > 0)
  const itemsSheet = exportData({ dataset: 'items' })
  assert.ok(itemsSheet[0].columns.some((c) => c.key === 'expected_profit'))
  assert.ok(itemsSheet[1].rows.length > 0)                                       // حركات كل المنتجات
  const purchaseLines = exportData({ dataset: 'purchases' })[1]
  assert.ok(purchaseLines.columns.some((c) => c.key === 'shipping_share') && purchaseLines.rows.length > 0)
  const saleInvoices = exportData({ dataset: 'sales' })[0]
  assert.ok(['shipping_payer', 'profit', 'cost_total', 'returns_total'].every((k) => saleInvoices.columns.some((c) => c.key === k)))
})

// ============================================================
// منع التكرار
// ============================================================
