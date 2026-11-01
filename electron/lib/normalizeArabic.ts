const INDIC = '٠١٢٣٤٥٦٧٨٩'

/** توحيد الحروف العربية علشان البحث يلاقي "احمد" لما يكون مكتوب "أحمد" */
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
