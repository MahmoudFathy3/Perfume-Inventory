/** أجزاء SQL مشتركة بين استعلامات الرئيسية: الفلتر بالتاريخ، وحساب الشحن، وخسارة المرتجعات */
export interface Range {
  from: string | null
  to: string | null
}
export interface Totals {
  count: number
  total: number
  shipping: number
}
export interface PeriodValue {
  period: string
  value: number | null
}

// فلتر التاريخ: لو from / to فاضيين بيرجع كل الفترة
export const range = (col: string) => `(@from IS NULL OR ${col} >= @from) AND (@to IS NULL OR ${col} <= @to)`

// شحن البيع اللي دفعه العميل (جزء من إجمالي الفاتورة) واللي دفعه المحل (مصروف)
export const CUSTOMER_SHIPPING = "CASE WHEN shipping_payer = 'customer' THEN shipping_cost ELSE 0 END"
export const SHOP_SHIPPING = "CASE WHEN shipping_payer = 'shop' THEN shipping_cost ELSE 0 END"

/**
 * ربح تحويلات "بيع بسعر" للمخزن اللي القطع طلعت منه، بيتسجل لما الطرف التاني يدفع (مش يوم التحويل):
 * كل دفعة على التحويل بتسجّل نصيبها من الربح بنسبتها من سعر التحويل وبتاريخها.
 * ربح التحويل = سعر التحويل − تكلفة القطع (بعد اللي رجع للمصدر). حذف الدفعة بيشيل ربحها.
 */
export const TRANSFER_PROFIT_FROM = `partner_payments pp JOIN transfers t ON t.id = pp.transfer_id
  WHERE t.kind = 'sale' AND t.total_price > 0`
export const TRANSFER_PROFIT = 'ABS(pp.amount) * (t.total_price - t.total_cost) / t.total_price'

// تكلفة القطعة وقت البيع للمرتجع (بنحسب الربح اللي ضاع بسبب مرتجع البيع)
export const RETURN_LOSS = `ri.quantity * (ri.unit_price - COALESCE(
  (SELECT SUM(si.quantity * si.purchase_price) * 1.0 / SUM(si.quantity)
   FROM sale_items si WHERE si.sale_id = r.sale_id AND si.item_id = ri.item_id), 0))`
