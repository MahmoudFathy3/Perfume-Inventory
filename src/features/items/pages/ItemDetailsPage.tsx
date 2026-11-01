import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import type { Movement, MovementType } from '@shared/types'
import { ExportMenu } from '@/shared/components/data/ExportMenu'
import { Pagination } from '@/shared/components/data/Pagination'
import { SearchBar } from '@/shared/components/data/SearchBar'
import { fromPurchase, fromReturn, fromSale } from '@/shared/components/invoice/invoice.types'
import type { InvoiceDocData } from '@/shared/components/invoice/invoice.types'
import { InvoiceViewer } from '@/shared/components/invoice/InvoiceViewer'
import { Alert, buttonClass, Card, Field, Input, PageHeader, Select, StatCard } from '@/shared/components/ui'
import { MOVEMENT_TYPES } from '@/shared/constants'
import { usePagination } from '@/shared/hooks/usePagination'
import { formatMoney, formatNumber } from '@/shared/utils/format'
import { normalizeArabic } from '@/shared/utils/normalizeArabic'
import { purchasesApi } from '../../purchases'
import { returnsApi } from '../../returns'
import { salesApi } from '../../sales'
import { MovementsTable } from '../components/MovementsTable'
import { StockSummary } from '../components/StockSummary'
import { useItemDetails } from '../hooks/useItemDetails'

/** بنجيب الفاتورة المناسبة لنوع الحركة ونحوّلها للشكل الموحّد للعرض والطباعة */
async function loadInvoice(type: MovementType, id: number): Promise<InvoiceDocData | null> {
  if (type === 'purchase') {
    const p = await purchasesApi.get({ id })
    return p && fromPurchase(p)
  }
  if (type === 'sale') {
    const s = await salesApi.get({ id })
    return s && fromSale(s)
  }
  const r = await returnsApi.get({ id })
  return r && fromReturn(r)
}

export default function ItemDetailsPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const { id } = useParams()
  const itemId = Number(id)
  const { details } = useItemDetails(itemId)
  const [filters, setFilters] = useState({ type: '', from: '', to: '', search: '' })
  const [invoice, setInvoice] = useState<InvoiceDocData | null>(null)

  const rows = useMemo(() => {
    if (!details) return []
    const q = normalizeArabic(filters.search)
    return details.movements.filter(
      (m) =>
        (!filters.type || m.type === filters.type) &&
        (!filters.from || m.date >= filters.from) &&
        (!filters.to || m.date <= filters.to) &&
        (!q || normalizeArabic(m.party).includes(q) || String(m.ref_id) === q)
    )
  }, [details, filters])

  const pagination = usePagination(rows, { resetKey: JSON.stringify(filters) })

  async function openInvoice(m: Movement) {
    setInvoice(await loadInvoice(m.type, m.ref_id))
  }

  if (!details) return <p className="p-10 text-center text-slate-500">{t('common.loading')}</p>
  const { item, totals, adjustments } = details
  const money = (v: number) => formatMoney(v, lang)
  const num = (v: number) => formatNumber(v, lang)
  const setFilter = (key: keyof typeof filters) => (value: string) => setFilters({ ...filters, [key]: value })
  const hasAdjustments = adjustments.new !== 0 || adjustments.damaged !== 0

  return (
    <>
      <PageHeader title={item.name_ar}>
        <ExportMenu target={{ dataset: 'movements', itemId }} />
        <Link className={buttonClass('secondary')} to="/items">{t('details.back')}</Link>
      </PageHeader>
      <p className="-mt-2 mb-4 text-slate-500">
        {item.name_en && <span dir="ltr">{item.name_en}</span>} · {item.category_name}
      </p>
      {item.deleted_at && <Alert tone="warning">{t('items.archivedBadge')}</Alert>}

      <div className="mb-3.5 grid grid-cols-2 gap-3.5">
        <StockSummary condition="new" item={item} />
        <StockSummary condition="damaged" item={item} />
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3.5 xl:grid-cols-[repeat(auto-fill,minmax(240px,1fr))]">
        <StatCard label={t('details.purchasedQty')} value={num(totals.purchased_qty)} sub={`${t('details.purchasesCost')}: ${money(totals.purchases_cost)}`} tone="indigo" />
        <StatCard label={t('details.soldQty')} value={num(totals.sold_qty)} sub={`${t('details.salesTotal')}: ${money(totals.sales_total)}`} tone="teal" />
        <StatCard label={t('details.returnsQty')} value={num(totals.sale_returns_qty + totals.purchase_returns_qty)} sub={t('details.returnsSub', { sale: totals.sale_returns_qty, purchase: totals.purchase_returns_qty })} />
        <StatCard label={t('details.profit')} value={money(totals.profit)} tone="green" big />
      </div>

      {hasAdjustments && <Alert tone="warning">{t('details.adjustmentsNote', { new: adjustments.new, damaged: adjustments.damaged })}</Alert>}

      <h2 className="mb-3 mt-7">{t('details.movements')}</h2>
      <Card className="mb-3.5 flex flex-wrap items-end gap-3.5 !py-3.5">
        <Field label={t('details.type')} className="!mb-0">
          <Select value={filters.type} onChange={(e) => setFilter('type')(e.target.value)}>
            <option value="">{t('details.allTypes')}</option>
            {MOVEMENT_TYPES.map((type) => (
              <option key={type} value={type}>{t(`details.types.${type}`)}</option>
            ))}
          </Select>
        </Field>
        <Field label={t('common.from')} className="!mb-0"><Input type="date" value={filters.from} onChange={(e) => setFilter('from')(e.target.value)} /></Field>
        <Field label={t('common.to')} className="!mb-0"><Input type="date" value={filters.to} onChange={(e) => setFilter('to')(e.target.value)} /></Field>
        <div className="ms-auto"><SearchBar value={filters.search} onChange={setFilter('search')} /></div>
      </Card>

      <MovementsTable rows={pagination.pageRows} onOpenInvoice={openInvoice} />
      <Pagination {...pagination} />

      {invoice && <InvoiceViewer data={invoice} onClose={() => setInvoice(null)} />}
    </>
  )
}
