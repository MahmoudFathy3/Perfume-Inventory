/**
 * حسابات فلوس فاتورة البيع في SQL (مكان واحد علشان كل الشاشات تطلع نفس الأرقام).
 * sale = العمود اللي فيه رقم الفاتورة (مثلًا "s.id").
 */

/** المدفوع الفعلي: الدفعات − اللي اترد للعميل كاش − اللي اتنقل من رصيده لفاتورة تانية */
export const salePaid = (sale: string) =>
  `(COALESCE((SELECT SUM(amount) FROM sale_payments WHERE sale_id = ${sale}), 0)
    - COALESCE((SELECT SUM(amount) FROM sale_refunds WHERE sale_id = ${sale}), 0))`

/** اللي اترد للعميل كاش من الفاتورة (مع مرتجعات) */
export const saleRefundedCash = (sale: string) => `COALESCE((SELECT SUM(amount) FROM sale_refunds WHERE sale_id = ${sale} AND kind = 'cash'), 0)`

/** رصيده من الفاتورة اللي اتخصم في فواتير تانية */
export const saleCreditUsed = (sale: string) => `COALESCE((SELECT SUM(amount) FROM sale_refunds WHERE sale_id = ${sale} AND kind = 'credit'), 0)`

/** إجمالي مرتجعات الفاتورة */
export const saleReturns = (sale: string) => `COALESCE((SELECT SUM(total) FROM returns WHERE sale_id = ${sale}), 0)`

/** الباقي على العميل (مش أقل من صفر). total = عمود إجمالي الفاتورة */
export const saleRemaining = (sale: string, total: string) => `MAX(0, ROUND(${total} - ${saleReturns(sale)} - ${salePaid(sale)}, 2))`

/** رصيد العميل في الفاتورة: اللي دفعه زيادة عن صافيها (بعد المرتجع) ولسه ما اتردّش ولا اتخصمش */
export const saleCredit = (sale: string, total: string) => `MAX(0, ROUND(${salePaid(sale)} - (${total} - ${saleReturns(sale)}), 2))`
