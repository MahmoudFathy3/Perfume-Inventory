import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Category, Item, PurchaseInput, PurchaseWithLines, WorkspacePartner } from '@shared/types'
import { useSubmit } from '../../hooks/useSubmit'
import { formatMoney, todayString } from '../../utils/format'
import { Field, FormActions, Input, NumberInput, Segmented } from '../ui'
import { InvoiceLinesTable } from './InvoiceLinesTable'
import { InvoiceTotals } from './InvoiceTotals'
import { purchaseToLines, toPurchaseLines, useInvoiceLines } from './useInvoiceLines'

/** اختيار "الشريكين مع بعض" في قايمة اللي اشترى */
const JOINT = 'joint'

interface PurchaseFormProps {
  items: Item[]
  categories: Category[]
  /** شركاء الشراكة النشطة (فاضية في المخزون الفعلي): لازم نختار مين اللي اشترى */
  partners?: WorkspacePartner[]
  /** فاتورة موجودة (وضع التعديل) */
  initial?: PurchaseWithLines | null
  onSubmit: (payload: PurchaseInput) => Promise<unknown>
  onCancel: () => void
}

/**
 * فاتورة شراء: الشريك اللي اشترى (في الشراكة) + المورد + سطور المنتجات (ممكن منتج جديد بصنفه) + الشحن (عليك)
 * + المدفوع للمورد (وقت الإنشاء بس، الافتراضي كله، والباقي بيتدفع بعد كده من دفعات الفاتورة).
 */
export function PurchaseForm({ items, categories, partners = [], initial, onSubmit, onCancel }: PurchaseFormProps) {
  const { t, i18n } = useTranslation()
  const [header, setHeader] = useState({
    supplier: initial?.supplier_name ?? '',
    date: initial?.purchase_date ?? todayString(),
    shipping: initial?.shipping_cost ? String(initial.shipping_cost) : '',
    notes: initial?.notes ?? '',
    paid: ''
  })
  // '' = لسه ما اختارش | رقم الشريك | JOINT = الشريكين مع بعض
  const [partnerId, setPartnerId] = useState(initial?.joint ? JOINT : initial?.partner_id ? String(initial.partner_id) : '')
  const [paidByPartner, setPaidByPartner] = useState(!!initial?.paid_by_partner)
  const joint = partnerId === JOINT
  const buyer = partners.find((p) => String(p.id) === partnerId)
  const state = useInvoiceLines('purchase', items, 'retail', initial ? purchaseToLines(initial) : undefined)
  const set = (key: keyof typeof header) => (value: string) => setHeader({ ...header, [key]: value })
  const fromPocket = (!!buyer || joint) && paidByPartner
  const shipping = Number(header.shipping) || 0
  // المدفوع للمورد: وقت الإنشاء اللي كاتبه (أو الفاتورة كلها)، وقت التعديل اللي اتدفع فعلًا. من جيب الشريك = كلها.
  const total = state.subtotal + shipping
  const paidNow = fromPocket ? total : initial ? initial.paid : header.paid === '' ? total : Number(header.paid) || 0

  const { submit, saving } = useSubmit(() =>
    onSubmit({
      supplier_name: header.supplier,
      partner_id: buyer ? buyer.id : null,
      joint,
      paid_by_partner: fromPocket,
      purchase_date: header.date,
      shipping_cost: header.shipping,
      notes: header.notes,
      ...(initial ? {} : { paid: header.paid }),
      items: toPurchaseLines(state.lines)
    })
  )

  return (
    <form onSubmit={submit}>
      {partners.length > 0 && (
        <div className="mb-3.5 flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-slate-500">{t('purchases.boughtBy')}</span>
          <Segmented
            value={partnerId}
            onChange={setPartnerId}
            options={[...partners.map((p) => ({ value: String(p.id), label: p.name })), { value: JOINT, label: t('purchases.bothPartners') }]}
          />
          {(buyer || joint) && (
            <label className={`mt-1 flex w-fit items-center gap-2 rounded-xl border px-3 py-2 text-sm ${paidByPartner ? 'border-green-200 bg-green-50 text-green-900' : 'border-slate-200 text-slate-600'}`}>
              <input type="checkbox" className="h-4 w-4 accent-primary-600" checked={paidByPartner} onChange={(e) => setPaidByPartner(e.target.checked)} />
              {buyer ? t('purchases.paidByPartner', { name: buyer.name }) : t('purchases.paidByBoth')}
            </label>
          )}
        </div>
      )}
      <div className="my-2 grid grid-cols-2 gap-x-4">
        <Field label={t('purchases.supplierName')}>
          <Input value={header.supplier} onChange={(e) => set('supplier')(e.target.value)} autoFocus />
        </Field>
        <Field label={t('common.date')}>
          <Input type="date" value={header.date} onChange={(e) => set('date')(e.target.value)} />
        </Field>
      </div>

      <InvoiceLinesTable kind="purchase" items={items} categories={categories} state={state} />

      <div className="my-2 mt-4 grid grid-cols-2 gap-x-4">
        <Field label={t('purchases.shippingCost')}>
          <NumberInput value={header.shipping} onChange={(e) => set('shipping')(e.target.value)} />
        </Field>
        <Field label={t('common.notes')}>
          <Input value={header.notes} onChange={(e) => set('notes')(e.target.value)} />
        </Field>
      </div>

      {!fromPocket && (
        <div className="grid grid-cols-2 gap-x-4">
          {initial ? (
            <Field label={t('purchases.paidToSupplier')}>
              <Input readOnly value={formatMoney(initial.paid, i18n.language)} className="bg-slate-50" />
            </Field>
          ) : (
            <Field label={t('purchases.paidNow')}>
              <NumberInput value={header.paid} placeholder={t('sales.paidAll')} onChange={(e) => set('paid')(e.target.value)} />
            </Field>
          )}
        </div>
      )}

      <InvoiceTotals subtotal={state.subtotal} shipping={shipping} paid={paidNow} />
      <FormActions saving={saving} onCancel={onCancel} />
    </form>
  )
}
