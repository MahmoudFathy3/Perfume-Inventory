/**
 * رقم التليفون بالشكل الدولي اللي واتساب عايزه (أرقام بس، من غير + ولا 00):
 * - الرقم المصري المحلي (01xxxxxxxxx: 11 رقم يبدأ بـ 01) بيتحط قبله كود مصر 20.
 * - اللي مكتوب بالكود الدولي (+... أو 00...) بيتشال منه الـ + / 00 ويفضل زي ما هو.
 * - الأرقام العربي (٠١٢...) بتتحوّل لإنجليزي، والمسافات والشرَط بتتشال.
 * بيرجّع null لو مفيش رقم أو الرقم قصير قوي.
 */
export function whatsappPhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  const latin = String(raw).replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
  const international = /^\s*(\+|00)/.test(latin)
  let digits = latin.replace(/\D/g, '')
  if (international && digits.startsWith('00')) digits = digits.slice(2)
  if (!international && /^01\d{9}$/.test(digits)) digits = `20${digits.slice(1)}`
  return digits.length >= 8 ? digits : null
}
