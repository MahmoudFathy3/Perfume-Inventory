import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Category, Item, PurchaseInput, PurchaseWithLines } from '@shared/types'
import { useSubmit } from '../../hooks/useSubmit'
import { todayString } from '../../utils/format'
import { Field, FormActions, Input, NumberInput } from '../ui'
import { InvoiceLinesTable } from './InvoiceLinesTable'
import { InvoiceTotals } from './InvoiceTotals'
import { purchaseToLines, toPurchaseLines, useInvoiceLines } from './useInvoiceLines'

interface PurchaseFormProps {
  items: Item[]
  categories: Category[]
  /** فاتورة موجودة (وضع التعديل) */
  initial?: PurchaseWithLines | null
  onSubmit: (payload: PurchaseInput) => Promise<unknown>
  onCancel: () => void
}

/** فاتورة شراء: المورد + سطور المنتجات (ممكن منتج جديد بصنفه) + الشحن (عليك) */
export function PurchaseForm({ items, categories, initial, onSubmit, onCancel }: PurchaseFormProps) {
  const { t } = useTranslation()
  const [header, setHeader] = useState({
    supplier: initial?.supplier_name ?? '',
    date: initial?.purchase_date ?? todayString(),
    shipping: initial?.shipping_cost ? String(initial.shipping_cost) : '',
    notes: initial?.notes ?? ''
  })
  const state = useInvoiceLines('purchase', items, 'retail', initial ? purchaseToLines(initial) : undefined)
  const set = (key: keyof typeof header) => (value: string) => setHeader({ ...header, [key]: value })

  const { submit, saving } = useSubmit(() =>
    onSubmit({
      supplier_name: header.supplier,
      purchase_date: header.date,
      shipping_cost: header.shipping,
      notes: header.notes,
      items: toPurchaseLines(state.lines)
    })
  )

  return (
    <form onSubmit={submit}>
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

      <InvoiceTotals subtotal={state.subtotal} shipping={Number(header.shipping) || 0} />
      <FormActions saving={saving} onCancel={onCancel} />
    </form>
  )
}
