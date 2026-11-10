import { normalizeArabic } from '../../utils/normalizeArabic'

export interface ProductTotal {
  name_ar: string
  name_en: string | null
  /** مجموع العدد في كل السطور (جديد وتالف) */
  quantity: number
  /** مجموع الفلوس (العدد × السعر في كل سطر) */
  total: number
}

/**
 * إجمالي كل منتج في الفاتورة: السطور اللي ليها نفس الاسم (من غير تفرقة همزة/تاء مربوطة/مسافات زيادة)
 * بتتجمع في سطر واحد: العدد كله وفلوسه كلها. بالترتيب اللي ظهر بيه أول مرة.
 */
export function productTotals(lines: { name_ar: string; name_en?: string | null; quantity: number; unit_price: number }[]): ProductTotal[] {
  const groups = new Map<string, ProductTotal>()
  for (const l of lines) {
    const name = l.name_ar.trim()
    if (!name) continue
    const key = normalizeArabic(name)
    const group = groups.get(key) ?? { name_ar: name, name_en: l.name_en ?? null, quantity: 0, total: 0 }
    group.quantity += l.quantity
    group.total = Math.round((group.total + l.quantity * l.unit_price) * 100) / 100
    groups.set(key, group)
  }
  return [...groups.values()]
}
