import { round4 } from './errors'

/**
 * المتوسط المرجّح للتكلفة.
 * بنحتفظ بـ 4 أرقام عشرية علشان ما يتراكمش فرق مع الوقت.
 */

/** إضافة قطع للمخزن: (قيمة الموجود + قيمة الجديد) ÷ إجمالي القطع */
export function addToAverage(qty: number, cost: number, addQty: number, addCost: number): number {
  if (qty <= 0) return round4(addCost)
  return round4((qty * cost + addQty * addCost) / (qty + addQty))
}

/** شيل قطع من المخزن بتكلفتها الأصلية: المتوسط بيتحسب من اللي فضل */
export function removeFromAverage(qty: number, cost: number, removeQty: number, removeCost: number): number {
  const left = qty - removeQty
  if (left <= 0) return cost
  return round4(Math.max(0, (qty * cost - removeQty * removeCost) / left))
}
