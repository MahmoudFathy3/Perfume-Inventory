import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Condition, Customer, FreeInvoiceInput, FreeInvoiceWithLines, Item, PriceType } from '@shared/types'
import { PRICE_TYPES } from '@/shared/constants'
import { CustomerSelect } from '@/shared/components/data/CustomerSelect'
import { ProductSelect } from '@/shared/components/data/ProductSelect'
import { Alert, Button, Field, FormActions, Input, NumberInput, Segmented, Select } from '@/shared/components/ui'
import { useSubmit } from '@/shared/hooks/useSubmit'
import { formatMoney, todayString } from '@/shared/utils/format'

/** سطر في الفورم: item_id = منتج من المخزون، name = بند من برّه (اتكتب بالاسم) */
interface Line {
  key: number
  item_id: number | ''
  condition: Condition
  name: string
  quantity: string
  unit_price: string
}

let nextKey = 1
const emptyLine = (): Line => ({ key: nextKey++, item_id: '', condition: 'new', name: '', quantity: '1', unit_price: '' })

const toLines = (invoice: FreeInvoiceWithLines): Line[] =>
  invoice.items.map((l) => ({
    key: nextKey++,
    item_id: l.item_id ?? '',
    condition: l.condition ?? 'new',
    name: l.item_id ? '' : l.name,
    quantity: String(l.quantity),
    unit_price: String(l.unit_price)
  }))

interface FreeInvoiceFormProps {
  items: Item[]
  customers: Customer[]
  onCreateCustomer: (name: string) => Promise<number>
  initial?: FreeInvoiceWithLines | null
  onSubmit: (payload: FreeInvoiceInput) => Promise<unknown>
  onCancel: () => void
}

/**
 * فاتورة حرّة: العميل (متسجل أو بالاسم والتليفون) + البنود (منتج من المخزون بيتملى اسمه وسعره، أو أي بند من برّه بالاسم)
 * + الشحن والخصم + المدفوع. مبتخصمش من المخزون ولا بتتحسب في المبيعات.
 */
export function FreeInvoiceForm({ items, customers, onCreateCustomer, initial, onSubmit, onCancel }: FreeInvoiceFormProps) {
  const { t, i18n } = useTranslation()
  const money = (v: number) => formatMoney(v, i18n.language)
  const linkedToSale = !!initial?.sale_id
  const [customerId, setCustomerId] = useState<number | ''>(initial?.customer_id ?? '')
  const [header, setHeader] = useState({
    date: initial?.invoice_date ?? todayString(),
    customer_name: initial?.customer_id ? '' : (initial?.customer_name ?? ''),
    customer_phone: initial?.customer_id ? '' : (initial?.customer_phone ?? ''),
    shipping: initial?.shipping_cost ? String(initial.shipping_cost) : '',
    discount: initial?.discount ? String(initial.discount) : '',
    notes: initial?.notes ?? '',
    paid: ''
  })
  const [priceType, setPriceType] = useState<PriceType>(initial?.price_type ?? 'retail')
  const [lines, setLines] = useState<Line[]>(() => (initial ? toLines(initial) : [emptyLine()]))
  const set = (key: keyof typeof header) => (value: string) => setHeader({ ...header, [key]: value })
  const itemById = (id: number | '') => (id ? items.find((i) => i.id === id) : undefined)

  /** سعر منتج المخزون حسب نوع السعر والحالة */
  const priceOf = (item: Item, condition: Condition, type: PriceType) => item[`${condition}_${type === 'wholesale' ? 'wholesale' : 'selling'}_price`]

  const update = (key: number, patch: Partial<Line>) =>
    setLines((all) =>
      all.map((l) => {
        if (l.key !== key) return l
        const next = { ...l, ...patch }
        // اختيار منتج أو تغيير حالته بيملى السعر
        const item = itemById(next.item_id)
        if (item && (patch.item_id !== undefined || patch.condition !== undefined)) next.unit_price = String(priceOf(item, next.condition, priceType))
        return next
      })
    )

  function changePriceType(type: PriceType) {
    setPriceType(type)
    setLines((all) =>
      all.map((l) => {
        const item = itemById(l.item_id)
        return item ? { ...l, unit_price: String(priceOf(item, l.condition, type)) } : l
      })
    )
  }

  const subtotal = lines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0), 0)
  const shipping = Number(header.shipping) || 0
  const discount = Number(header.discount) || 0
  const total = Math.round((subtotal + shipping - discount) * 100) / 100
  const paid = initial ? initial.paid : header.paid === '' ? total : Number(header.paid) || 0

  const { submit, saving } = useSubmit(() =>
    onSubmit({
      customer_id: customerId || null,
      customer_name: header.customer_name,
      customer_phone: header.customer_phone,
      invoice_date: header.date,
      price_type: priceType,
      shipping_cost: header.shipping,
      discount: header.discount,
      notes: header.notes,
      ...(initial ? {} : { paid: header.paid }),
      items: lines
        .filter((l) => l.item_id || l.name.trim())
        .map((l) => ({ item_id: l.item_id || null, condition: l.item_id ? l.condition : null, name: l.name, quantity: l.quantity, unit_price: l.unit_price }))
    })
  )

  return (
    <form onSubmit={submit}>
      <div className="my-2 grid grid-cols-2 gap-x-4">
        <Field label={t('freeInvoices.customer')}>
          <CustomerSelect customers={customers} value={customerId} onChange={setCustomerId} onCreate={onCreateCustomer} />
        </Field>
        <Field label={t('common.date')}>
          <Input type="date" value={header.date} onChange={(e) => set('date')(e.target.value)} />
        </Field>
      </div>
      {/* العميل مش متسجل: اسمه وتليفونه بيتكتبوا في الفاتورة بس */}
      {!customerId && (
        <div className="grid grid-cols-2 gap-x-4">
          <Field label={t('freeInvoices.customerName')}>
            <Input value={header.customer_name} placeholder={t('freeInvoices.customerNameHint')} onChange={(e) => set('customer_name')(e.target.value)} />
          </Field>
          <Field label={t('freeInvoices.customerPhone')}>
            <Input value={header.customer_phone} dir="ltr" onChange={(e) => set('customer_phone')(e.target.value)} />
          </Field>
        </div>
      )}

      <div className="mb-3.5 flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold text-slate-500">{t('sales.priceType')}</span>
        <Segmented value={priceType} onChange={changePriceType} options={PRICE_TYPES.map((p) => ({ value: p, label: t(`sales.${p}`) }))} />
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-2 py-2.5 text-start">{t('freeInvoices.line')}</th>
              <th className="w-32 px-2 py-2.5 text-start">{t('condition.label')}</th>
              <th className="w-24 px-2 py-2.5 text-start">{t('common.quantity')}</th>
              <th className="w-32 px-2 py-2.5 text-start">{t('invoice.unitPrice')}</th>
              <th className="w-28 px-2 py-2.5 text-start">{t('invoice.lineTotal')}</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lines.map((l) => {
              const item = itemById(l.item_id)
              const value = l.item_id ? { item_id: l.item_id, name: '', label: initial?.items.find((x) => x.item_id === l.item_id)?.name } : { item_id: '' as const, name: l.name }
              return (
                <tr key={l.key}>
                  <td className="min-w-[260px] px-2 py-2 align-top">
                    <ProductSelect
                      items={items}
                      value={value}
                      allowCreate
                      createLabel={(name) => t('freeInvoices.externalItem', { name })}
                      onChange={(v) => update(l.key, { item_id: v.item_id, name: v.name })}
                    />
                    <small className="mt-1 block text-slate-500">{l.item_id ? t('freeInvoices.fromStock') : l.name ? t('freeInvoices.external') : ''}</small>
                  </td>
                  <td className="px-2 py-2 align-top">
                    {item ? (
                      <Select value={l.condition} onChange={(e) => update(l.key, { condition: e.target.value as Condition })}>
                        <option value="new">{t('condition.new')}</option>
                        <option value="damaged">{t('condition.damaged')}</option>
                      </Select>
                    ) : (
                      <span className="block py-2 text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-2 py-2 align-top">
                    <NumberInput value={l.quantity} step={1} min={1} onChange={(e) => update(l.key, { quantity: e.target.value })} />
                  </td>
                  <td className="px-2 py-2 align-top">
                    <NumberInput value={l.unit_price} onChange={(e) => update(l.key, { unit_price: e.target.value })} />
                  </td>
                  <td className="px-2 py-2 align-top font-bold tabular-nums">
                    <span className="block py-2">{money((Number(l.quantity) || 0) * (Number(l.unit_price) || 0))}</span>
                  </td>
                  <td className="px-1 py-2 align-top">
                    <Button size="sm" variant="danger" icon={Trash2} aria-label={t('common.delete')} disabled={lines.length === 1} onClick={() => setLines((all) => all.filter((x) => x.key !== l.key))} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <Button className="mt-2" size="sm" icon={Plus} onClick={() => setLines((all) => [...all, emptyLine()])}>{t('freeInvoices.addLine')}</Button>
      {linkedToSale && <Alert tone="info">{t('freeInvoices.linkedEditNote', { id: initial!.sale_id })}</Alert>}

      <div className="mt-4 grid grid-cols-3 gap-x-4">
        <Field label={t('freeInvoices.shipping')}>
          <NumberInput value={header.shipping} onChange={(e) => set('shipping')(e.target.value)} />
        </Field>
        <Field label={t('invoice.discount')}>
          <NumberInput value={header.discount} onChange={(e) => set('discount')(e.target.value)} />
        </Field>
        {initial ? (
          <Field label={t('invoice.paid')}>
            <Input readOnly value={money(initial.paid)} className="bg-slate-50" />
          </Field>
        ) : (
          <Field label={t('sales.paidNow')}>
            <NumberInput value={header.paid} placeholder={t('sales.paidAll')} onChange={(e) => set('paid')(e.target.value)} />
          </Field>
        )}
      </div>
      <Field label={t('common.notes')}>
        <Input value={header.notes} onChange={(e) => set('notes')(e.target.value)} />
      </Field>

      <div className="ms-auto mt-2 w-72 space-y-1 rounded-xl bg-slate-50 px-4 py-3 text-sm">
        <Row label={t('invoice.subtotal')} value={money(subtotal)} />
        {shipping > 0 && <Row label={t('invoice.shipping')} value={money(shipping)} />}
        {discount > 0 && <Row label={t('invoice.discount')} value={`− ${money(discount)}`} />}
        <Row label={t('invoice.total')} value={money(total)} strong />
        <Row label={t('invoice.paid')} value={money(paid)} />
        <Row label={t('invoice.remaining')} value={money(Math.max(0, total - paid))} strong />
      </div>
      <FormActions saving={saving} onCancel={onCancel} />
    </form>
  )
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? 'border-t border-slate-200 pt-1 font-bold' : ''}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}
