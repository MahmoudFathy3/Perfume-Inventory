// نفس منطق الـ backend: توحيد الحروف العربية علشان المطابقة والبحث
const INDIC = '٠١٢٣٤٥٦٧٨٩'

export function normalizeArabic(text: unknown): string {
  return String(text ?? '')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[٠-٩]/g, (d) => String(INDIC.indexOf(d)))
    .toLowerCase()
    .trim()
}

export const sameText = (a: unknown, b: unknown): boolean => normalizeArabic(a) !== '' && normalizeArabic(a) === normalizeArabic(b)
