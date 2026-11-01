import { useTranslation } from 'react-i18next'
import type { PartnerSales } from '@shared/types'
import { DataTable } from '@/shared/components/ui'
import type { Column } from '@/shared/components/ui'
import { formatMoney, formatNumber } from '@/shared/utils/format'

/** مبيعات كل شريك في الفترة: عدد الفواتير اللي عملها وإجماليها والمرتجع والصافي والمحصّل */
export function PartnerSalesTable({ rows }: { rows: PartnerSales[] }) {
  const { t, i18n } = useTranslation()
  const money = (v: number) => formatMoney(v, i18n.language)

  const columns: Column<PartnerSales>[] = [
    { key: 'name', header: t('partners.partner'), cell: (r) => (r.partner_name ? <strong>{r.partner_name}</strong> : <span className="text-slate-400">{t('sales.noPartner')}</span>) },
    { key: 'invoices', header: t('partners.invoices'), cell: (r) => formatNumber(r.invoices, i18n.language) },
    { key: 'total', header: t('common.total'), cell: (r) => money(r.total) },
    { key: 'returns', header: t('partners.returns'), cell: (r) => money(r.returns_total) },
    { key: 'net', header: t('partners.netSales'), cell: (r) => <strong>{money(r.net)}</strong> },
    { key: 'paid', header: t('partners.collected'), cell: (r) => money(r.paid) }
  ]

  return <DataTable columns={columns} rows={rows} rowKey={(r) => r.partner_id ?? 0} />
}
