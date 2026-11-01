import type { Condition } from '@shared/types'

/** خطأ معروف بنرجّعه للواجهة ككود (الواجهة هي اللي بتترجمه) */
export class AppError extends Error {
  readonly code: string

  constructor(code: string) {
    super(code)
    this.code = code
  }
}

/** تحويل أي خطأ لكود بسيط الواجهة تترجمه */
export function toErrorCode(e: unknown): string {
  if (e instanceof AppError) return e.code
  const code = (e as { code?: unknown } | null)?.code
  if (typeof code === 'string') {
    if (code === 'SQLITE_CONSTRAINT_FOREIGNKEY') return 'IN_USE'
    if (code === 'SQLITE_CONSTRAINT_UNIQUE') return 'DUPLICATE'
    if (code === 'SQLITE_CONSTRAINT_CHECK') return 'INVALID_DATA'
  }
  console.error(e)
  return 'UNKNOWN'
}

const pad = (n: number): string => String(n).padStart(2, '0')

/** تاريخ اليوم بتوقيت الجهاز (مش UTC) علشان فواتير بعد منتصف الليل ما تتسجلش في اليوم اللي قبله */
export function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export const round2 = (n: number): number => Math.round(n * 100) / 100
export const round4 = (n: number): number => Math.round(n * 10000) / 10000

// ---------- تحويل وفحص المدخلات ----------

/** رقم >= 0 (الفاضي = 0) */
export function money(v: unknown, code = 'INVALID_NUMBER'): number {
  const n = Number(v ?? 0)
  if (!Number.isFinite(n) || n < 0) throw new AppError(code)
  return n
}

/** مبلغ أكبر من صفر (للتحصيل) */
export function positiveAmount(v: unknown, code = 'INVALID_AMOUNT'): number {
  const n = Number(v)
  if (!Number.isFinite(n) || n <= 0) throw new AppError(code)
  return round2(n)
}

/** رقم >= 0 أو null لو الحقل فاضي */
export function optionalMoney(v: unknown): number | null {
  return v === undefined || v === null || v === '' ? null : money(v)
}

/** كمية صحيحة > 0 */
export function qty(v: unknown): number {
  const n = Number(v)
  if (!Number.isInteger(n) || n <= 0) throw new AppError('INVALID_QUANTITY')
  return n
}

export function parseCondition(v: unknown): Condition {
  if (v !== 'new' && v !== 'damaged') throw new AppError('INVALID_CONDITION')
  return v
}
