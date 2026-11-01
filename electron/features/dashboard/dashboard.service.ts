import type { DashboardRange, DashboardSummary, WorkspaceOverview } from '@shared/types'
import { round2, today } from '../../lib/errors'
import { withWorkspace } from '../../lib/workspace'
import { listWorkspaces } from '../workspaces/workspaces.service'
import { buildPeriods, previousRange } from './dashboard.periods'
import * as repo from './dashboard.repository'

/** الربح الفعلي للفترة = ربح الأصناف - ربح ضاع بمرتجعات البيع - شحن بيع على المحل */
const profitOf = (range: repo.Range, shopShipping: number): number => repo.grossProfit(range) - repo.returnsLoss(range) - shopShipping

const toMap = (rows: { period: string; value: number | null }[]) => Object.fromEntries(rows.map((r) => [r.period, r.value || 0]))

const ALL_TIME: repo.Range = { from: null, to: null }

/** الربح الفعلي للمخزن النشط من أول يوم (بيستخدمه ملخص المخازن وحسابات الشركاء) */
export const lifetimeProfit = (): number => profitOf(ALL_TIME, repo.sales(ALL_TIME).shop_shipping)

/** ملخص كل المخازن المفتوحة (الفعلي والشراكات): بيتحسب لكل واحد على بياناته هو بس */
export function overview(): WorkspaceOverview[] {
  return listWorkspaces()
    .filter((w) => !w.closed_at)
    .map((workspace) =>
      withWorkspace(workspace.id, () => {
        const stock = repo.stock()
        return {
          workspace,
          pieces: stock.pieces,
          cost_value: round2(stock.cost_value),
          selling_value: round2(stock.selling_value),
          receivables: round2(repo.receivables()),
          today_sales: round2(repo.salesOfDay(today()).total),
          profit: round2(lifetimeProfit())
        }
      })
    )
}

export function summary(input: Partial<DashboardRange> = {}): DashboardSummary {
  const p: repo.Range = { from: input.from || null, to: input.to || null }

  const stock = repo.stock()
  const purchases = repo.purchases(p)
  const sales = repo.sales(p)
  const saleReturns = repo.returnsOf('sale', p)
  const purchaseReturns = repo.returnsOf('purchase', p)
  const bounds = repo.dataRange()
  const { mode, periods } = buildPeriods(p.from || bounds.min, p.to || bounds.max)
  const len = mode === 'month' ? 7 : 10

  const salesMap = toMap(repo.salesBy(p, len))
  const purchasesMap = toMap(repo.purchasesBy(p, len))
  const profitMap = toMap(repo.profitBy(p, len))
  const lossMap = toMap(repo.lossBy(p, len))
  const shopShippingMap = toMap(repo.shopShippingBy(p, len))

  const prev = previousRange(p.from, p.to)
  const todaySales = repo.salesOfDay(today())

  return {
    stock: {
      pieces: stock.pieces,
      new_pieces: stock.new_pieces,
      damaged_pieces: stock.damaged_pieces,
      cost_value: round2(stock.cost_value), // رأس المال
      new_cost_value: round2(stock.new_cost_value),
      damaged_cost_value: round2(stock.damaged_cost_value),
      selling_value: round2(stock.selling_value),
      expected_profit: round2(stock.selling_value - stock.cost_value)
    },
    purchases: {
      count: purchases.count,
      total: round2(purchases.total),
      shipping: round2(purchases.shipping),
      returns: round2(purchaseReturns.total),
      net: round2(purchases.total - purchaseReturns.total)
    },
    sales: {
      count: sales.count,
      products: round2(sales.products), // مبيعات المنتجات من غير شحن العميل
      shipping: round2(sales.shipping),
      shop_shipping: round2(sales.shop_shipping),
      total: round2(sales.total),
      returns_count: saleReturns.count,
      returns: round2(saleReturns.total),
      net_products: round2(sales.products - saleReturns.total)
    },
    today: { count: todaySales.count, total: round2(todaySales.total) },
    receivables: round2(repo.receivables()),
    collected: round2(repo.collected(p)),
    profit: round2(profitOf(p, sales.shop_shipping)),
    profit_previous: prev ? { ...prev, profit: round2(profitOf(prev, repo.sales(prev).shop_shipping)) } : null,
    counts: repo.counts(),
    charts: {
      mode,
      series: periods.map((period) => ({
        period,
        sales: round2(salesMap[period] || 0),
        purchases: round2(purchasesMap[period] || 0),
        profit: round2((profitMap[period] || 0) - (lossMap[period] || 0) - (shopShippingMap[period] || 0))
      })),
      top: repo.topProducts(p),
      stock: { new: stock.new_pieces, damaged: stock.damaged_pieces }
    }
  }
}
