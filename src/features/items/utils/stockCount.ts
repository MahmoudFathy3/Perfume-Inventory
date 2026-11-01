import type { Item } from '@shared/types'
import { itemName } from '../../../shared/utils/format'

/** الخط الفاصل بين الأصناف (ـ ممدودة) */
const SEPARATOR = 'ـ'.repeat(22)

export interface StockCountOptions {
  /** اسم المخزن: بيتكتب في أول سطر قبل الأصناف */
  title?: string
  /** الكلمة اللي بعد اسم المنتج للجديد والتالف (مثلًا "سليم" و"ديفوه") */
  labels: { new: string; damaged: string }
}

/**
 * جرد المخزن (للعرض والنسخ):
 *
 *   دخوني
 *
 *   10 توباكو سليم
 *   3 توباكو ديفوه
 *   5 روز سليم
 *
 * سطر للجديد وسطر للتالف لو موجود، والمنتج اللي مفيش منه خالص مبيتكتبش.
 * الأصناف والمنتجات بالترتيب الأبجدي.
 */
export function buildStockCount(source: Item[], lang: string, { title, labels }: StockCountOptions): string {
  const items = source.filter((i) => i.new_quantity > 0 || i.damaged_quantity > 0)
  if (items.length === 0) return ''
  const collator = new Intl.Collator(lang === 'ar' ? 'ar' : 'en')

  const groups = new Map<string, Item[]>()
  for (const item of items) groups.set(item.category_name, [...(groups.get(item.category_name) ?? []), item])

  const blocks = [...groups.entries()]
    .sort(([a], [b]) => collator.compare(a, b))
    .map(([category, products]) => {
      const lines = products
        .sort((a, b) => collator.compare(itemName(a, lang), itemName(b, lang)))
        .flatMap((p) => {
          const name = itemName(p, lang)
          const out: string[] = []
          if (p.new_quantity > 0) out.push(`${p.new_quantity} ${name} ${labels.new}`)
          if (p.damaged_quantity > 0) out.push(`${p.damaged_quantity} ${name} ${labels.damaged}`)
          return out
        })
      return `${category}\n\n${lines.join('\n')}`
    })

  const body = blocks.join(`\n\n${SEPARATOR}\n`)
  return title ? `${title}\n\n${body}` : body
}
