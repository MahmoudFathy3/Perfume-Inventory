import type { TFunction } from 'i18next'
import { CURRENCY } from '../constants'

// الأرقام دايمًا بالإنجليزي (0-9) حتى في الواجهة العربية
const numberLocale = (lang: string) => (lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US')

export const formatMoney = (value: number | null | undefined, lang: string): string =>
  new Intl.NumberFormat(numberLocale(lang), { style: 'currency', currency: CURRENCY }).format(value || 0)

export const formatNumber = (value: number | null | undefined, lang: string): string =>
  new Intl.NumberFormat(numberLocale(lang)).format(value || 0)

/** التاريخ: يوم/شهر/سنة بأرقام إنجليزي */
export function formatDate(value: string | null | undefined): string {
  if (!value) return ''
  const [y, m, d] = value.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

const pad = (n: number) => String(n).padStart(2, '0')
const toDateString = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** تاريخ النهاردة بتوقيت الجهاز (مش UTC) */
export const todayString = (): string => toDateString(new Date())

export function daysAgoString(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return toDateString(d)
}

export const monthStartString = (): string => {
  const d = new Date()
  return toDateString(new Date(d.getFullYear(), d.getMonth(), 1))
}

interface Named {
  name_ar: string
  name_en: string | null
}

/** اسم المنتج حسب لغة التطبيق، ولو مفيش ترجمة يرجع للعربي */
export const itemName = (item: Named, lang: string): string => (lang === 'en' && item.name_en ? item.name_en : item.name_ar)

/** «عربي - English» (لو مفيش إنجليزي بيظهر العربي بس) */
export const bilingualName = (item: Named): string => (item.name_en ? `${item.name_ar} - ${item.name_en}` : item.name_ar)

/** ترجمة كود الخطأ القادم من الـ backend */
export const errorText = (t: TFunction, error: unknown): string => {
  const code = error instanceof Error ? error.message : ''
  return t(`errors.${code}`, { defaultValue: t('errors.UNKNOWN') })
}
