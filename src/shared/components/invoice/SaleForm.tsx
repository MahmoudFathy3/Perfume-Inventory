import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Customer, Item, PriceType, SaleInput, SaleWithLines, ShippingPayer } from '@shared/types'
import { PRICE_TYPES, SHIPPING_PAYERS } from '../../constants'
import { useSubmit } from '../../hooks/useSubmit'
import { formatMoney, todayString } from '../../utils/format'
import { CustomerSelect } from '../data/CustomerSelect'
import { Field, FormActions, Input, NumberInput, Segmented } from '../ui'
import { InvoiceLinesTable } from './InvoiceLinesTable'
import { InvoiceTotals } from './InvoiceTotals'
import { saleToLines, toSaleLines, useInvoiceLines } from './useInvoiceLines'

interface SaleFormProps {
  items: Item[]
  customers: Customer[]
  /** بيعمل عميل جديد من قايمة العملاء وبيرجّع id */
  onCreateCustomer: (name: string) => Promise<number>
  /** فاتورة موجودة (وضع التعديل) */
  initial?: SaleWithLines | null
  onSubmit: (payload: SaleInput) => Promise<unknown>
  onCancel: () => void
}

/**
 * فاتورة بيع: العميل (بالبحث) + قطاعي/جملة + سطور المنتجات + الشحن (على العميل أو المحل) + المدفوع.
 * المدفوع بيتحدد وقت الإنشاء بس (الافتراضي كله)، والتحصيل بعد كده من صفحة العملاء.
 */
export function SaleForm({ items, customers, onCreateCustomer, initial, onSubmit, onCancel }: SaleFormProps) {
  const { t, i18n } = useTranslation()
  const editing = !!initial
  const [customerId, setCustomerId] = useState<number | ''>(initial?.customer_id ?? '')
  const [header, setHeader] = useState({
    date: initial?.sale_date ?? todayString(),
    shipping: initial?.shipping_cost ? String(initial.shipping_cost) : '',
    notes: initial?.notes ?? '',
    paid: ''
  })
  const [priceType, setPriceType] = useState<PriceType>(initial?.price_type ?? 'retail')
  const [payer, setPayer] = useState<ShippingPayer>(initial?.shipping_payer ?? 'customer')
  const state = useInvoiceLines('sale', items, priceType, initial ? saleToLines(initial) : undefined)
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

      <InvoiceLinesTable kind="sale" items={items} state={state} />

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
