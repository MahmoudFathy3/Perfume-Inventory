import type { Condition, Item, PriceType } from '@shared/types'
import { itemName } from '../../../shared/utils/format'

/** الخط الفاصل بين الأصناف (ـ ممدودة) */
const SEPARATOR = 'ـ'.repeat(22)
/** أقل مسافة بين اسم المنتج وسعره */
const GAP = 4

/** السعر بدون عملة أو فواصل: 2000 / 99.5 (ولو مفيش سعر بنكتب —) */
export const formatListPrice = (value: number): string => (value > 0 ? String(Math.round(value * 100) / 100) : '—')

/**
 * قايمة المنتجات للنسخ (مثلًا للإرسال على واتساب):
 *
 *   دخوني
 *
 *   خليفه        2000
 *   روز          1200
 *
 *   ـــــــــــــــــــــــــــــــــــــــــــ
 *   ابراق
 *   ...
 *
 * الصنف أول حاجة وتحته منتجاته، وجنب كل منتج سعر القطعة بس: بالقطاعي (retail) أو بالجملة (wholesale).
 * الأسعار من الجديد (السليم) أو التالف (الديفوه) حسب condition.
 * الأصناف والمنتجات بالترتيب الأبجدي.
 */
export interface PriceListOptions {
  priceType?: PriceType
  /** الجديد (السليم) أو التالف (الديفوه): منه الأسعار والكمية. الافتراضي الجديد. */
  condition?: Condition
  /** اسم المخزن: بيتكتب في أول سطر قبل الأصناف (مثلًا "شراكة محمود وأحمد") */
  title?: string
  /** المنتجات اللي كميتها (من condition) صفر مبتتكتبش، والصنف اللي كل منتجاته صفر بيختفي */
  inStockOnly?: boolean
}

export function buildPriceList(source: Item[], lang: string, { priceType = 'retail', condition = 'new', title, inStockOnly = false }: PriceListOptions = {}): string {
  const items = inStockOnly ? source.filter((i) => i[`${condition}_quantity`] > 0) : source
  if (items.length === 0) return ''
  const collator = new Intl.Collator(lang === 'ar' ? 'ar' : 'en')
  const priceOf = (item: Item) => item[`${condition}_${priceType === 'wholesale' ? 'wholesale' : 'selling'}_price`]

  const groups = new Map<string, { name: string; price: number }[]>()
  for (const item of items) {
    const list = groups.get(item.category_name) ?? []
    list.push({ name: itemName(item, lang), price: priceOf(item) })
    groups.set(item.category_name, list)
  }

  // عرض واحد لكل القايمة علشان الأسعار تيجي تحت بعض
  const width = Math.max(...items.map((i) => itemName(i, lang).length)) + GAP

  const blocks = [...groups.entries()]
    .sort(([a], [b]) => collator.compare(a, b))
    .map(([category, products]) => {
      const lines = products.sort((a, b) => collator.compare(a.name, b.name)).map((p) => `${p.name.padEnd(width)}${formatListPrice(p.price)}`)
      return `${category}\n\n${lines.join('\n')}`
    })

  const body = blocks.join(`\n\n${SEPARATOR}\n`)
  return title ? `${title}\n\n${body}` : body
}
