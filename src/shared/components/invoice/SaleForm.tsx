import clsx from 'clsx'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Customer, Item, PriceType, SaleInput, SaleWithLines, ShippingPayer, WorkspacePartner } from '@shared/types'
import { PRICE_TYPES, SHIPPING_PAYERS } from '../../constants'
import { useSubmit } from '../../hooks/useSubmit'
import { formatMoney, todayString } from '../../utils/format'
import { CustomerSelect } from '../data/CustomerSelect'
import { Alert, Field, FormActions, Input, NumberInput, Segmented } from '../ui'
import { InvoiceLinesTable } from './InvoiceLinesTable'
import { InvoiceTotals } from './InvoiceTotals'
import { saleToLines, toSaleLines, useInvoiceLines } from './useInvoiceLines'

interface SaleFormProps {
  items: Item[]
  customers: Customer[]
  /** شركاء الشراكة النشطة (فاضية في المخزون الفعلي): لازم نختار مين اللي باع */
  partners?: WorkspacePartner[]
  /** بيعمل عميل جديد من قايمة العملاء وبيرجّع id */
  onCreateCustomer: (name: string) => Promise<number>
  /** منتجات مخازن تانية ينفع تتباع في نفس الفاتورة (المخزون الفعلي ↔ الشراكات): بتتحوّل تلقائي وقت الحفظ */
  foreign?: { workspace_id: number; name: string; items: Item[] }[]
  /** اسم مخزن الفاتورة (عنوان قسم منتجاته في القايمة) */
  storeLabel?: string
  /** فاتورة موجودة (وضع التعديل) */
  initial?: SaleWithLines | null
  onSubmit: (payload: SaleInput) => Promise<unknown>
  onCancel: () => void
}

/**
 * فاتورة بيع: الشريك اللي باع (في الشراكة) + العميل (بالبحث) + قطاعي/جملة + سطور المنتجات + الشحن (على العميل أو المحل) + المدفوع.
 * المدفوع بيتحدد وقت الإنشاء بس (الافتراضي كله)، والتحصيل بعد كده من صفحة العملاء.
 */
export function SaleForm({ items, customers, partners = [], foreign = [], storeLabel = '', onCreateCustomer, initial, onSubmit, onCancel }: SaleFormProps) {
  const { t, i18n } = useTranslation()
  const editing = !!initial
  const [customerId, setCustomerId] = useState<number | ''>(initial?.customer_id ?? '')
  const [partnerId, setPartnerId] = useState(initial?.partner_id ? String(initial.partner_id) : '')
  const [header, setHeader] = useState({
    date: initial?.sale_date ?? todayString(),
    shipping: initial?.shipping_cost ? String(initial.shipping_cost) : '',
    notes: initial?.notes ?? '',
    paid: ''
  })
  const [priceType, setPriceType] = useState<PriceType>(initial?.price_type ?? 'retail')
  const [payer, setPayer] = useState<ShippingPayer>(initial?.shipping_payer ?? 'customer')
  // منتجات المخزن ده + المخازن التانية في قايمة واحدة (أرقام المنتجات مش بتتكرر بين المخازن)
  const sourceById = new Map(foreign.flatMap((f) => f.items.map((i) => [i.id, f.workspace_id] as const)))
  const allItems = foreign.length > 0 ? [...items, ...foreign.flatMap((f) => f.items)] : items
  const storeName = (id: number) => foreign.find((f) => f.workspace_id === id)?.name ?? `#${id}`
  const tagOf = (item: Item) => {
    const source = sourceById.get(item.id)
    return source === undefined ? null : storeName(source)
  }
  const state = useInvoiceLines('sale', allItems, priceType, initial ? saleToLines(initial) : undefined, (id) => sourceById.get(id) ?? null)
  const hasForeign = state.lines.some((l) => l.source_workspace_id !== null)
  // منتجات المخازن التانية مقفولة افتراضيًا (علشان القايمة متتلخبطش)، وبتتفتح بالزرار أو لو الفاتورة فيها منها
  const [showForeign, setShowForeign] = useState(() => !!initial?.items.some((l) => l.source_workspace_id !== null))
  const foreignOn = foreign.length > 0 && (showForeign || hasForeign)
  const otherNames = foreign.map((f) => f.name).join(' / ')
  const groups = foreignOn ? [{ label: storeLabel, items }, ...foreign.map((f) => ({ label: f.name, items: f.items }))] : undefined
  const set = (key: keyof typeof header) => (value: string) => setHeader({ ...header, [key]: value })

  const shippingCost = Number(header.shipping) || 0
  const invoiceTotal = state.subtotal + (payer === 'customer' ? shippingCost : 0)
  // وقت الإنشاء: المدفوع اللي كاتبه (أو الفاتورة كلها). وقت التعديل: اللي اتحصّل فعلًا.
  const paidNow = initial ? initial.paid : header.paid === '' ? invoiceTotal : Number(header.paid) || 0

  function changePriceType(type: PriceType) {
    setPriceType(type)
    state.reprice(type)
  }

  const { submit, saving } = useSubmit(() =>
    onSubmit({
      customer_id: customerId || null,
      partner_id: partnerId ? Number(partnerId) : null,
      sale_date: header.date,
      price_type: priceType,
      shipping_payer: payer,
      shipping_cost: header.shipping,
      notes: header.notes,
      ...(editing ? {} : { paid: header.paid }),
      items: toSaleLines(state.lines)
    })
  )

  return (
    <form onSubmit={submit}>
      {partners.length > 0 && (
        <div className="mb-3.5 flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-slate-500">{t('sales.soldBy')}</span>
          <Segmented value={partnerId} onChange={setPartnerId} options={partners.map((p) => ({ value: String(p.id), label: p.name }))} />
        </div>
      )}
      <div className="my-2 grid grid-cols-2 gap-x-4">
        <Field label={t('sales.customerName')}>
          <CustomerSelect customers={customers} value={customerId} onChange={setCustomerId} onCreate={onCreateCustomer} />
        </Field>
        <Field label={t('common.date')}>
          <Input type="date" value={header.date} onChange={(e) => set('date')(e.target.value)} />
        </Field>
      </div>

      <div className="mb-3.5 flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold text-slate-500">{t('sales.priceType')}</span>
        <Segmented value={priceType} onChange={changePriceType} options={PRICE_TYPES.map((p) => ({ value: p, label: t(`sales.${p}`) }))} />
      </div>

      {foreign.length > 0 && (
        <label className={clsx('mb-2.5 flex w-fit items-center gap-2 rounded-xl border px-3 py-2 text-sm', foreignOn ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-slate-200 text-slate-600')}>
          <input
            type="checkbox"
            className="h-4 w-4 accent-primary-600"
            checked={foreignOn}
            disabled={hasForeign}
            title={hasForeign ? t('sales.foreignLocked') : undefined}
            onChange={(e) => setShowForeign(e.target.checked)}
          />
          {t('sales.foreignToggle', { name: otherNames })}
        </label>
      )}
      <InvoiceLinesTable kind="sale" items={foreignOn ? allItems : items} state={state} tagOf={tagOf} groups={groups} storeName={storeName} />
      {hasForeign && <Alert tone="info">{t('sales.foreignNote')}</Alert>}

      <div className="my-2 mt-4 grid grid-cols-2 gap-x-4">
        <Field label={t('sales.shippingCost')}>
          <NumberInput value={header.shipping} onChange={(e) => set('shipping')(e.target.value)} />
        </Field>
        <div className="mb-3.5 flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-slate-500">{t('sales.shippingPayer')}</span>
          <Segmented value={payer} onChange={setPayer} options={SHIPPING_PAYERS.map((p) => ({ value: p, label: t(p === 'customer' ? 'sales.payerCustomer' : 'sales.payerShop') }))} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4">
        <Field label={t('common.notes')}>
          <Input value={header.notes} onChange={(e) => set('notes')(e.target.value)} />
        </Field>
        {initial ? (
          <Field label={t('invoice.paid')}>
            <Input readOnly value={formatMoney(initial.paid, i18n.language)} className="bg-slate-50" />
          </Field>
        ) : (
          <Field label={t('sales.paidNow')}>
            <NumberInput value={header.paid} placeholder={t('sales.paidAll')} onChange={(e) => set('paid')(e.target.value)} />
          </Field>
        )}
      </div>

      <InvoiceTotals subtotal={state.subtotal} shipping={payer === 'customer' ? shippingCost : 0} shopShipping={payer === 'shop' ? shippingCost : 0} paid={paidNow} />
      <FormActions saving={saving} onCancel={onCancel} />
    </form>
  )
}
