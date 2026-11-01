import assert from 'node:assert/strict'
import test from 'node:test'
import type { Item } from '@shared/types'
import { buildPriceList, formatListPrice } from '../../src/features/items/utils/priceList'

const item = (name_ar: string, category_name: string, price: number, extra: Partial<Item> = {}): Item => ({
  id: 1, name_ar, name_en: null, category_id: 1, category_name,
  new_quantity: 5, new_purchase_price: 10, new_selling_price: price, new_wholesale_price: 1,
  damaged_quantity: 0, damaged_purchase_price: 0, damaged_selling_price: 7, damaged_wholesale_price: 0, deleted_at: null, ...extra
})

test('قايمة المنتجات: الصنف وتحته منتجاته وجنب كل منتج سعر القطعة بس', () => {
  const text = buildPriceList(
    [item('خليفه', 'دخوني', 2000), item('روز', 'دخوني', 1200), item('مسك باودر', 'ابراق', 1100), item('فرينش توباكو', 'ابراق', 1250)],
    'ar'
  )
  const sep = 'ـ'.repeat(22)
  assert.equal(text.split('\n')[0], 'ابراق') // الأصناف بالترتيب الأبجدي
  const lines = text.split('\n')
  assert.deepEqual(lines.filter((l) => /\d/.test(l)).map((l) => l.trim().split(/\s+/).slice(-1)[0]), ['1250', '1100', '2000', '1200'])
  assert.ok(text.includes(`\n\n${sep}\nدخوني\n\n`)) // سطر فاضي، فاصل، اسم الصنف، سطر فاضي
  assert.ok(lines.includes('ابراق') && lines.includes('دخوني') && lines.includes(sep))
  const numbers = text.match(/\d+/g)?.sort()
  assert.deepEqual(numbers, ['1100', '1200', '1250', '2000']) // أسعار القطعة بس: مفيش شراء (10) ولا جملة (1) ولا تالف (7)

  // الأسعار تحت بعض: كل أسطر المنتجات نفس الطول لحد بداية السعر
  const priceCols = lines.filter((l) => /\s\d+$/.test(l)).map((l) => l.search(/\d+$/))
  assert.equal(new Set(priceCols).size, 1)
  assert.ok(priceCols[0] >= 'فرينش توباكو'.length + 4) // أقل مسافة 4 بين الاسم والسعر
})

test('قايمة المنتجات: الأسعار بدون فواصل أو عملة، وبدون سعر بتظهر —', () => {
  assert.equal(formatListPrice(2000), '2000')
  assert.equal(formatListPrice(99.5), '99.5')
  assert.equal(formatListPrice(10.456), '10.46')
  assert.equal(formatListPrice(0), '—')
  assert.equal(buildPriceList([], 'ar'), '')
  const withName = buildPriceList([item('ورد', 'أ', 0, { name_en: 'Rose' })], 'en')
  assert.ok(withName.includes('Rose') && withName.trim().endsWith('—')) // لغة الإنجليزي بتستخدم الاسم الإنجليزي
})

test('قايمة الجملة: نفس الترتيب بس بأسعار الجملة', () => {
  const rows = [
    item('خليفه', 'دخوني', 2000, { new_wholesale_price: 1700 }),
    item('روز', 'دخوني', 1200, { new_wholesale_price: 1000 }),
    item('مسك باودر', 'ابراق', 1100, { new_wholesale_price: 0 })
  ]
  const retail = buildPriceList(rows, 'ar')
  const wholesale = buildPriceList(rows, 'ar', { priceType: 'wholesale' })
  const lines = (text: string) => text.split('\n')

  assert.deepEqual(lines(retail).map((l) => l.replace(/\s+\d+$/, '')), lines(wholesale).map((l) => l.replace(/\s+(\d+|—)$/, '')))
  assert.deepEqual(wholesale.match(/\d+|—/g), ['—', '1700', '1000']) // الأسعار من عمود الجملة، ومن غير سعر جملة بتظهر —
  assert.deepEqual(retail.match(/\d+/g), ['1100', '2000', '1200'])
})

test('نسخ المخزن: اسم المخزن فوق، والمنتج اللي كميته صفر مبيتكتبش، والصنف الفاضي بيختفي', () => {
  const rows = [
    item('خليفه', 'دخوني', 2000, { new_quantity: 5, new_wholesale_price: 1700 }),
    item('روز', 'دخوني', 1200, { new_quantity: 0 }),
    item('مسك باودر', 'ابراق', 1100, { new_quantity: 0 }),
    item('فرينش توباكو', 'ابراق', 1250, { new_quantity: 3, new_wholesale_price: 1050 }),
    item('تالف بس', 'ابراق', 900, { new_quantity: 0, damaged_quantity: 4 })
  ]
  const retail = buildPriceList(rows, 'ar', { title: 'شراكة محمود وأحمد', inStockOnly: true })
  assert.equal(retail.split('\n')[0], 'شراكة محمود وأحمد')
  assert.equal(retail.split('\n')[1], '')
  assert.deepEqual(retail.match(/\d+/g), ['1250', '2000']) // روز ومسك والتالف مش موجودين
  assert.ok(!retail.includes('روز') && !retail.includes('مسك') && !retail.includes('تالف'))
  assert.deepEqual(buildPriceList(rows, 'ar', { priceType: 'wholesale', inStockOnly: true }).match(/\d+/g), ['1050', '1700'])

  // صنف كل منتجاته صفر مبيظهرش خالص
  const onlyEmpty = [item('روز', 'دخوني', 1200, { new_quantity: 0 }), item('ورد', 'ابراق', 500, { new_quantity: 2 })]
  assert.ok(!buildPriceList(onlyEmpty, 'ar', { inStockOnly: true }).includes('دخوني'))
  assert.equal(buildPriceList([item('روز', 'دخوني', 1200, { new_quantity: 0 })], 'ar', { inStockOnly: true }), '') // مفيش حاجة تتنسخ
  assert.ok(buildPriceList(rows, 'ar').includes('روز')) // من غير الفلتر (صفحة المنتجات) بتظهر كلها
})

test('قايمة الديفوه: أسعار وكمية التالف بس، واللي مفيش منه تالف مبيظهرش', () => {
  const rows = [
    item('روز', 'دخوني', 1200, { damaged_quantity: 2, damaged_selling_price: 800, damaged_wholesale_price: 650 }),
    item('خليفه', 'دخوني', 2000), // سليم بس
    item('توباكو', 'ابراق', 1500, { new_quantity: 0, damaged_quantity: 3, damaged_selling_price: 900, damaged_wholesale_price: 700 })
  ]
  const retail = buildPriceList(rows, 'ar', { condition: 'damaged', inStockOnly: true, title: 'المنتجات الديفوه' })
  assert.equal(retail.split('\n')[0], 'المنتجات الديفوه')
  assert.deepEqual(retail.match(/\d+/g), ['900', '800'])
  assert.ok(!retail.includes('خليفه'))
  assert.deepEqual(buildPriceList(rows, 'ar', { condition: 'damaged', priceType: 'wholesale', inStockOnly: true }).match(/\d+/g), ['700', '650'])
  assert.equal(buildPriceList([item('خليفه', 'دخوني', 2000)], 'ar', { condition: 'damaged', inStockOnly: true }), '')
})
