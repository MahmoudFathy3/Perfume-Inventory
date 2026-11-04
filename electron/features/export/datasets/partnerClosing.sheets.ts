import type { ExportParams } from '@shared/types'
import { today } from '../../../lib/errors'
import { monthlyClosing } from '../../partners/partners.service'
import { type Row, type SheetDef, col } from './sheet'

const closingOf = ({ month }: ExportParams) => monthlyClosing({ month: month || today().slice(0, 7) })

/** أرقام الشهر في الشراكة */
export const closingSummarySheet: SheetDef = {
  key: 'closing_summary',
  layout: 'record',
  columns: [
    col('month', 'text'), col('sales_count', 'number'), col('sales_total', 'money'), col('returns_total', 'money'),
    col('profit', 'money'), col('deducted_total', 'money'), col('net_profit', 'money')
  ],
  rows: (p) => {
    const c = closingOf(p)
    return [{ month: c.month, sales_count: c.sales.count, sales_total: c.sales.total, returns_total: c.sales.returns, profit: c.profit, deducted_total: c.expenses, net_profit: c.net_profit }]
  }
}

/** حساب كل شريك في الشهر */
export const closingPartnersSheet: SheetDef = {
  key: 'closing_partners',
  columns: [
    col('partner', 'text', 20), col('share_percent', 'number', 10), col('opening_balance', 'money', 18), col('profit_share', 'money', 18),
    col('sold_to_partnership', 'money', 18), col('paid_from_pocket', 'money', 18), col('settled', 'money', 18),
    col('closing_balance', 'money', 18), col('capital', 'money', 18)
  ],
  rows: (p) =>
    closingOf(p).rows.map<Row>((r) => ({
      partner: r.partner.name,
      share_percent: r.partner.share_percent,
      opening_balance: r.opening,
      profit_share: r.profit_share,
      sold_to_partnership: r.sold,
      paid_from_pocket: r.paid_out,
      settled: r.settled,
      closing_balance: r.closing,
      capital: r.capital
    }))
}
