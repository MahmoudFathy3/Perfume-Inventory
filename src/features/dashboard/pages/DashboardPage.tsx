import { MessageCircle } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { invoke } from '@/shared/api/ipc'
import { Button, PageHeader, StatCard } from '@/shared/components/ui'
import { useToast } from '@/shared/toast/ToastProvider'
import { StockCountButton } from '@/features/items'
import { WarehousePage } from '@/features/warehouse'
import { useWorkspaces } from '@/features/workspaces'
import { formatMoney, formatNumber } from '@/shared/utils/format'
import { CapitalCard } from '../components/CapitalCard'
import { CopyStockButtons } from '../components/CopyStockButtons'
import { PartnersShare } from '../components/PartnersShare'
import { ReservedCard } from '../components/ReservedCard'
import { TransfersMoney } from '../components/TransfersMoney'
import { WorkspacesOverview } from '../components/WorkspacesOverview'
import { ProfitChart } from '../components/charts/ProfitChart'
import { SalesPurchasesChart } from '../components/charts/SalesPurchasesChart'
import { StockConditionChart } from '../components/charts/StockConditionChart'
import { TopProductsChart } from '../components/charts/TopProductsChart'
import { DateRangeFilter } from '@/shared/components/data/DateRangeFilter'
import type { DateRange } from '@/shared/components/data/DateRangeFilter'
import { useDashboard } from '../hooks/useDashboard'

const grid = 'grid gap-3.5'

/** الرئيسية: في المخزن الخارجي هي صفحة منتجاته وشحناته (ملوش أرقام فلوس) */
export default function DashboardPage() {
  const { active } = useWorkspaces()
  return active.kind === 'warehouse' ? <WarehousePage /> : <StoreDashboard />
}

function StoreDashboard() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const [range, setRange] = useState<DateRange>({ from: '', to: '' })
  const { summary: s } = useDashboard(range)
  const { active, label } = useWorkspaces()

  const money = (v: number) => formatMoney(v, lang)
  const num = (v: number) => formatNumber(v, lang)
  const current = t('dashboard.currentNote')
  const toast = useToast()

  /** واتساب جوه البرنامج (نفس النافذة اللي بتتبعت منها الفواتير) */
  async function openWhatsApp() {
    try {
      await invoke('share:open-whatsapp')
    } catch (e) {
      toast.fail(e)
    }
  }

  return (
    <>
      <PageHeader title={<>{t('dashboard.title')} <small className="font-normal text-slate-500">— {label(active)}</small></>}>
        <Button icon={MessageCircle} onClick={() => void openWhatsApp()} className="!border-green-200 !text-green-700 hover:!bg-green-50">{t('share.whatsapp')}</Button>
        <StockCountButton />
        <StockCountButton only="damaged" />
        <CopyStockButtons />
      </PageHeader>

      <WorkspacesOverview />

      {!s ? (
        <p className="p-10 text-center text-slate-500">{t('common.loading')}</p>
      ) : (
        <>
          {/* ===== الثابت: مبيتأثرش بالفلتر ===== */}
          <h2 className="mb-3">{t('dashboard.stockTitle')} <small className="font-normal text-slate-500">— {t('dashboard.fixedNote')}</small></h2>
          {/* رأس المال + دايرة المخزون جنب بعض، وتحتهم 8 كروت في صفين كاملين (4 × 2) */}
          <div className={`${grid} lg:grid-cols-[minmax(0,1fr)_300px] 2xl:grid-cols-[minmax(0,1fr)_360px]`}>
            <CapitalCard stock={s.stock} />
            <StockConditionChart stock={s.charts.stock} />
          </div>
          <div className={`${grid} mt-3.5 grid-cols-2 lg:grid-cols-4`}>
            <StatCard label={t('dashboard.totalPieces')} value={num(s.stock.pieces)} sub={current} tone="teal" big />
            <StatCard label={t('dashboard.newPieces')} value={num(s.stock.new_pieces)} sub={current} tone="teal" />
            <StatCard label={t('dashboard.damagedPieces')} value={num(s.stock.damaged_pieces)} sub={current} tone="teal" />
            <StatCard label={t('dashboard.salesToday')} value={money(s.today.total)} sub={t('dashboard.invoicesSub', { count: s.today.count })} tone="teal" big />
            <StatCard label={t('dashboard.receivables')} value={money(s.receivables)} sub={t('dashboard.receivablesSub')} tone="indigo" big />
            <StatCard label={t('dashboard.itemsCount')} value={num(s.counts.items)} sub={current} />
            <StatCard label={t('dashboard.categoriesCount')} value={num(s.counts.categories)} sub={current} />
            <StatCard label={t('dashboard.customersCount')} value={num(s.counts.customers)} sub={current} />
          </div>

          <ReservedCard />

          <TransfersMoney />

          {/* ===== الفلتر + اللي بيتأثر بيه ===== */}
          <h2 className="mb-3 mt-7">{t('dashboard.periodTitle')} <small className="font-normal text-slate-500">— {t('dashboard.periodNote')}</small></h2>
          <DateRangeFilter range={range} onChange={setRange} />

          <div className={`${grid} my-3.5 grid-cols-[repeat(auto-fill,minmax(200px,1fr))] xl:grid-cols-[repeat(auto-fill,minmax(240px,1fr))]`}>
            <StatCard label={t('dashboard.purchasesTotal')} value={money(s.purchases.total)} sub={t('dashboard.invoicesSub', { count: s.purchases.count })} tone="indigo" />
            <StatCard label={t('dashboard.salesPeriod')} value={money(s.sales.products)} sub={t('dashboard.invoicesSub', { count: s.sales.count })} tone="indigo" />
            {s.transfer_sales.count > 0 && (
              <StatCard
                label={t('dashboard.transferSales')}
                value={money(s.transfer_sales.total)}
                sub={`${t('dashboard.transferSalesSub', { count: s.transfer_sales.count, pieces: num(s.transfer_sales.pieces) })} · ${t('dashboard.paidOf', { paid: money(s.transfer_sales.paid), total: money(s.transfer_sales.total) })}`}
                tone="indigo"
              />
            )}
            <StatCard label={t('dashboard.saleReturns')} value={money(s.sales.returns)} sub={t('dashboard.returnsSub', { count: s.sales.returns_count })} tone="indigo" />
            <StatCard label={t('dashboard.shopShipping')} value={money(s.sales.shop_shipping)} sub={t('dashboard.shopShippingSub')} tone="slate" />
            <StatCard label={t('dashboard.collected')} value={money(s.collected)} sub={t('dashboard.collectedSub')} tone="green" />
            <StatCard label={t('dashboard.invoicesCount')} value={`${num(s.purchases.count)} / ${num(s.sales.count)}`} />
            <StatCard label={t('dashboard.actualProfit')} value={money(s.profit)} tone="green" big />
            <StatCard
              label={t('dashboard.expenses')}
              value={money(s.expenses.total)}
              sub={s.expenses.deducted === s.expenses.total ? t('dashboard.expensesSub', { count: s.expenses.count }) : t('dashboard.expensesDeductedSub', { amount: money(s.expenses.deducted) })}
              tone="slate"
            />
            <StatCard label={t('dashboard.netProfit')} value={money(s.net_profit)} sub={t('dashboard.netProfitSub')} tone="green" big />
          </div>

          <PartnersShare summary={s} />

          <div className={`${grid} grid-cols-[repeat(auto-fit,minmax(min(440px,100%),1fr))]`}>
            <ProfitChart series={s.charts.series} profit={s.profit} previous={s.profit_previous ? s.profit_previous.profit : null} />
            <SalesPurchasesChart series={s.charts.series} />
            <TopProductsChart top={s.charts.top} />
          </div>
        </>
      )}
    </>
  )
}
