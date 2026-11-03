import { Eye, Pencil, Trash2, UserRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { customerLabel } from '../../utils/partyName'
import type { Purchase, Sale } from '@shared/types'
import { usePrint } from '../../print/PrintProvider'
import { formatDate, formatMoney } from '../../utils/format'
import { Badge, Button, DataTable, PaymentStatusBadge, PriceTypeBadge, RowActions } from '../ui'
import type { Column } from '../ui'
import { CustomerNameLabel } from './CustomerNameLabel'
import { grossPaid, SalePaidCell } from './SalePaidCell'

type Row = Purchase | Sale
const isSale = (row: Row): row is Sale => 'customer_id' in row

interface InvoicesTableProps<T extends Row> {
  kind: 'purchase' | 'sale'
  rows: T[]
  onView: (row: T) => void
  onEdit: (row: T) => void
  onDelete: (row: T) => void
  /** في الشراكة: عمود الشريك اللي باع / اشترى */
  showPartner?: boolean
}

/** جدول مشترك لقايمة فواتير الشراء والبيع (عرض / تعديل / حذف) */
export function InvoicesTable<T extends Row>({ kind, rows, onView, onEdit, onDelete, showPartner = false }: InvoicesTableProps<T>) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const { print } = usePrint()
  const purchase = kind === 'purchase'
  const money = (v: number) => formatMoney(v, lang)

  const saleColumns: Column<T>[] = purchase
    ? []
    : [
        { key: 'priceType', header: t('sales.priceType'), cell: (r) => (isSale(r) ? <PriceTypeBadge type={r.price_type} /> : null) },
        { key: 'paid', header: t('invoice.paid'), cell: (r) => (isSale(r) ? <SalePaidCell sale={r} /> : null) },
        {
          key: 'remaining',
          header: t('invoice.remaining'),
          cell: (r) => (isSale(r) ? <strong className={r.remaining > 0 ? 'text-rose-600' : 'text-slate-400'}>{money(r.remaining)}</strong> : null)
        },
        { key: 'status', header: t('payment.status'), cell: (r) => (isSale(r) ? <PaymentStatusBadge paid={grossPaid(r)} remaining={r.remaining} /> : null) }
      ]

  const columns: Column<T>[] = [
    { key: 'id', header: '#', cell: (r) => r.id },
    { key: 'date', header: t('common.date'), cell: (r) => formatDate(isSale(r) ? r.sale_date : r.purchase_date) },
    { key: 'party', header: t(purchase ? 'purchases.supplierName' : 'sales.customerName'), cell: (r) => (isSale(r) ? (r.customer_name ? customerLabel(r.customer_name, r.customer_is_partner, t) : t('invoice.noParty')) : r.supplier_name) },
    ...(showPartner
      ? [{ key: 'partner', header: t(purchase ? 'purchases.boughtBy' : 'sales.soldBy'), cell: (r: T) => (
            <span className="flex flex-col items-start gap-0.5">
              {r.partner_name ?? <span className="text-slate-400">{t('sales.noPartner')}</span>}
              {!isSale(r) && r.paid_by_partner === 1 && <small className="whitespace-nowrap text-green-700">{t('purchases.fromPocket')}</small>}
            </span>
          ) }]
      : []),
    ...saleColumns,
    {
      key: 'shipping',
      header: t(purchase ? 'purchases.shippingCost' : 'sales.shippingCost'),
      cell: (r) => (
        <span className="flex items-center gap-2 whitespace-nowrap">
          {money(r.shipping_cost)}
          {isSale(r) && r.shipping_cost > 0 && (
            <Badge tone={r.shipping_payer === 'shop' ? 'amber' : 'sky'}>{t(r.shipping_payer === 'shop' ? 'sales.payerShop' : 'sales.payerCustomer')}</Badge>
          )}
        </span>
      )
    },
    { key: 'total', header: t('common.total'), cell: (r) => <strong>{money(r.total)}</strong> },
    { key: 'notes', header: t('common.notes'), cell: (r) => r.notes },
    {
      key: 'actions',
      header: '',
      cell: (r) => (
        <RowActions>
          <Button size="sm" icon={Eye} onClick={() => onView(r)}>{t('common.view')}</Button>
          {isSale(r) && r.customer_name && (
            <Button size="sm" icon={UserRound} title={t('invoice.printName')} onClick={() => print(<CustomerNameLabel name={r.customer_name!} />)}>{t('invoice.printNameShort')}</Button>
          )}
          <Button size="sm" icon={Pencil} onClick={() => onEdit(r)}>{t('common.edit')}</Button>
          <Button size="sm" variant="danger" icon={Trash2} onClick={() => onDelete(r)}>{t('common.delete')}</Button>
        </RowActions>
      )
    }
  ]

  return <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} />
}
