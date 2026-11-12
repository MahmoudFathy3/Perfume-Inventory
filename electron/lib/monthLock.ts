/**
 * قفل الشهور والأيام المقفولة: أي حاجة بتاريخ في شهر أو يوم مقفول في مخزنها (فاتورة، دفعة، مرتجع، مصروف، تحويل، تسوية)
 * مينفعش تتضاف ولا تتعدّل ولا تتحذف لحد ما يتفتح تاني (MONTH_CLOSED / DAY_CLOSED).
 * - الشهر للشراكات بس، واليوم للمخزون الفعلي والشراكات.
 * - الشهر بيتقفل وكله مدفوع، فأي دفعة على فاتورة منه مرفوضة. اليوم ممكن يتقفل وفيه آجل،
 *   فالتحصيل في يوم مفتوح على فاتورة من يوم مقفول مسموح (day: false في فحص الفاتورة).
 */
import { queryOne } from '../database/connection'
import { AppError, today } from './errors'
import { activeWorkspaceId } from './workspace'

/** الشهر (YYYY-MM) مقفول في المخزن ده؟ */
export const isMonthClosed = (workspaceId: number, month: string): boolean =>
  !!queryOne('SELECT 1 FROM month_closings WHERE workspace_id = ? AND month = ?', [workspaceId, month])

/** اليوم (YYYY-MM-DD) مقفول في المخزن ده؟ */
export const isDayClosed = (workspaceId: number, day: string): boolean =>
  !!queryOne('SELECT 1 FROM day_closings WHERE workspace_id = ? AND day = ?', [workspaceId, day])

/** day = false: بيشيّك على الشهر بس (فاتورة بتتدفع في يوم تاني) */
type LockOptions = { day?: boolean }

/** بيرفض لو التاريخ (الفاضي = النهارده) في شهر أو يوم مقفول في أي مخزن من دول */
export function assertOpen(date: string | null | undefined, workspaceIds: number[] = [activeWorkspaceId()], { day = true }: LockOptions = {}): void {
  const value = (date || today()).slice(0, 10)
  if (workspaceIds.some((ws) => isMonthClosed(ws, value.slice(0, 7)))) throw new AppError('MONTH_CLOSED')
  if (day && workspaceIds.some((ws) => isDayClosed(ws, value))) throw new AppError('DAY_CLOSED')
}

type Dated = { date: string; ws: number } | undefined

const check = (row: Dated, options?: LockOptions): void => {
  if (row) assertOpen(row.date, [row.ws], options)
}

/** فاتورة بيع موجودة: تاريخها في شهر (أو يوم) مقفول؟ */
export const assertSaleOpen = (saleId: number, options?: LockOptions) =>
  check(queryOne<{ date: string; ws: number }>('SELECT sale_date AS date, workspace_id AS ws FROM sales WHERE id = ?', [saleId]), options)

export const assertPurchaseOpen = (purchaseId: number, options?: LockOptions) =>
  check(queryOne<{ date: string; ws: number }>('SELECT purchase_date AS date, workspace_id AS ws FROM purchases WHERE id = ?', [purchaseId]), options)

/** دفعة عميل: تاريخها (شهر ويوم)، وشهر فاتورتها */
export function assertSalePaymentOpen(paymentId: number): void {
  const row = queryOne<{ date: string; sale_id: number; ws: number }>(
    'SELECT sp.payment_date AS date, sp.sale_id, s.workspace_id AS ws FROM sale_payments sp JOIN sales s ON s.id = sp.sale_id WHERE sp.id = ?',
    [paymentId]
  )
  check(row)
  if (row) assertSaleOpen(row.sale_id, { day: false })
}

/** دفعة مورد: تاريخها (شهر ويوم)، وشهر فاتورتها */
export function assertPurchasePaymentOpen(paymentId: number): void {
  const row = queryOne<{ date: string; purchase_id: number; ws: number }>(
    'SELECT pp.payment_date AS date, pp.purchase_id, p.workspace_id AS ws FROM purchase_payments pp JOIN purchases p ON p.id = pp.purchase_id WHERE pp.id = ?',
    [paymentId]
  )
  check(row)
  if (row) assertPurchaseOpen(row.purchase_id, { day: false })
}

export const assertReturnOpen = (returnId: number) =>
  check(queryOne<{ date: string; ws: number }>('SELECT return_date AS date, workspace_id AS ws FROM returns WHERE id = ?', [returnId]))

export const assertExpenseOpen = (expenseId: number) =>
  check(queryOne<{ date: string; ws: number }>('SELECT expense_date AS date, workspace_id AS ws FROM expenses WHERE id = ?', [expenseId]))

/** تحويل: تاريخه مقفول في أي طرف من الطرفين؟ */
export function assertTransferOpen(transferId: number, options?: LockOptions): void {
  const t = queryOne<{ date: string; from_ws: number; to_ws: number }>(
    'SELECT transfer_date AS date, from_workspace_id AS from_ws, to_workspace_id AS to_ws FROM transfers WHERE id = ?',
    [transferId]
  )
  if (t) assertOpen(t.date, [t.from_ws, t.to_ws], options)
}

/** تسوية شريك (أو دفعة تحويل): تاريخها في شراكتها، ولو تبع تحويل كمان شهر التحويل */
export function assertPartnerPaymentOpen(paymentId: number): void {
  const row = queryOne<{ date: string; ws: number; transfer_id: number | null }>(
    'SELECT payment_date AS date, workspace_id AS ws, transfer_id FROM partner_payments WHERE id = ?',
    [paymentId]
  )
  check(row)
  if (row?.transfer_id) assertTransferOpen(row.transfer_id, { day: false })
}
