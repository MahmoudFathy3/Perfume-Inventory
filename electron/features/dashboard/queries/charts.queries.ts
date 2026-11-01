/** بيانات الرسوم البيانية (مجمّعة باليوم أو الشهر) وأفضل المنتجات */
import type { TopProduct } from '@shared/types'
import { queryAll, queryOne } from '../../../database/connection'
import { inWorkspace } from '../../../lib/workspace'
import type { Range, PeriodValue } from './shared'
import { range, CUSTOMER_SHIPPING, SHOP_SHIPPING, RETURN_LOSS } from './shared'

// ---- بيانات الرسوم (بيتجمّع بالنهاردة أو بالشهر) ----
export const salesBy = (p: Range, len: number) =>
  queryAll<PeriodValue>(
    `SELECT substr(sale_date, 1, ${len}) AS period, SUM(total - ${CUSTOMER_SHIPPING}) AS value
     FROM sales WHERE ${inWorkspace('workspace_id')} AND ${range('sale_date')} GROUP BY period`,
    { ...p }
  )

export const purchasesBy = (p: Range, len: number) =>
  queryAll<PeriodValue>(
    `SELECT substr(purchase_date, 1, ${len}) AS period, SUM(total) AS value
     FROM purchases WHERE ${inWorkspace('workspace_id')} AND ${range('purchase_date')} GROUP BY period`,
    { ...p }
  )

export const profitBy = (p: Range, len: number) =>
  queryAll<PeriodValue>(
    `SELECT substr(s.sale_date, 1, ${len}) AS period, SUM(si.quantity * (si.selling_price - si.purchase_price)) AS value
     FROM sale_items si JOIN sales s ON s.id = si.sale_id WHERE ${inWorkspace('s.workspace_id')} AND ${range('s.sale_date')} GROUP BY period`,
    { ...p }
  )

/** شحن البيع اللي على المحل (مصروف) مجمّع بالفترة */
export const shopShippingBy = (p: Range, len: number) =>
  queryAll<PeriodValue>(
    `SELECT substr(sale_date, 1, ${len}) AS period, SUM(${SHOP_SHIPPING}) AS value
     FROM sales WHERE ${inWorkspace('workspace_id')} AND ${range('sale_date')} GROUP BY period`,
    { ...p }
  )

export const lossBy = (p: Range, len: number) =>
  queryAll<PeriodValue>(
    `SELECT substr(r.return_date, 1, ${len}) AS period, SUM(${RETURN_LOSS}) AS value
     FROM return_items ri JOIN returns r ON r.id = ri.return_id AND r.type = 'sale'
     WHERE ${inWorkspace('r.workspace_id')} AND ${range('r.return_date')} GROUP BY period`,
    { ...p }
  )

export const dataRange = () =>
  queryOne<{ min: string | null; max: string | null }>(
    `SELECT MIN(d) AS min, MAX(d) AS max FROM
     (SELECT sale_date AS d FROM sales WHERE ${inWorkspace('workspace_id')}
      UNION ALL SELECT purchase_date FROM purchases WHERE ${inWorkspace('workspace_id')}
      UNION ALL SELECT return_date FROM returns WHERE ${inWorkspace('workspace_id')})`
  )!

export const topProducts = (p: Range) =>
  queryAll<TopProduct>(
    `SELECT i.id, i.name_ar, i.name_en, SUM(si.quantity) AS quantity, SUM(si.quantity * si.selling_price) AS revenue
     FROM sale_items si JOIN sales s ON s.id = si.sale_id JOIN items i ON i.id = si.item_id
     WHERE ${inWorkspace('s.workspace_id')} AND ${range('s.sale_date')} GROUP BY i.id ORDER BY quantity DESC, revenue DESC LIMIT 5`,
    { ...p }
  )
