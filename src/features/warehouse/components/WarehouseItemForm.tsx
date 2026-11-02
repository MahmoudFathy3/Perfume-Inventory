import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { WarehouseItem, WarehouseItemInput } from '@shared/types'
import { Field, FormActions, Input, NumberInput } from '@/shared/components/ui'
import { useSubmit } from '@/shared/hooks/useSubmit'
import { formatSar, totalCost, unitCost } from '../utils/costs'

interface WarehouseItemFormProps {
  initial: WarehouseItem | null
  onSubmit: (values: WarehouseItemInput) => Promise<unknown>
  onCancel: () => void
}

const money = (v: number | undefined) => (v ? String(v) : '')

/** منتج في المخزن الخارجي: الاسم والكمية وتكلفة القطعة بالريال (السعر + الشحن + الجمارك) */
export function WarehouseItemForm({ initial, onSubmit, onCancel }: WarehouseItemFormProps) {
  const { t, i18n } = useTranslation()
  const [values, setValues] = useState({
    name: initial?.name ?? '',
    quantity: initial ? String(initial.quantity) : '',
    unit_price: money(initial?.unit_price),
    shipping: money(initial?.shipping),
    customs: money(initial?.customs),
    notes: initial?.notes ?? ''
  })
  const set = (key: keyof typeof values) => (value: string) => setValues({ ...values, [key]: value })
  const { submit, saving } = useSubmit(() => onSubmit(values))

  const numbers = {
    quantity: Number(values.quantity) || 0,
    unit_price: Number(values.unit_price) || 0,
    shipping: Number(values.shipping) || 0,
    customs: Number(values.customs) || 0
  }
  const sar = (v: number) => formatSar(v, i18n.language)

  return (
    <form onSubmit={submit}>
      <div className="grid grid-cols-[1fr_140px] gap-x-4">
        <Field label={t('common.name')}>
          <Input value={values.name} onChange={(e) => set('name')(e.target.value)} autoFocus />
        </Field>
        <Field label={t('common.quantity')}>
          <NumberInput step={1} value={values.quantity} placeholder="0" onChange={(e) => set('quantity')(e.target.value)} />
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-x-4">
        <Field label={t('warehouse.unitPrice')}>
          <NumberInput value={values.unit_price} placeholder="0" onChange={(e) => set('unit_price')(e.target.value)} />
        </Field>
        <Field label={t('warehouse.shipping')}>
          <NumberInput value={values.shipping} placeholder="0" onChange={(e) => set('shipping')(e.target.value)} />
        </Field>
        <Field label={t('warehouse.customs')}>
          <NumberInput value={values.customs} placeholder="0" onChange={(e) => set('customs')(e.target.value)} />
        </Field>
      </div>
      <p className="mb-4 rounded-xl bg-slate-50 px-4 py-2.5 text-sm text-slate-600">
        {t('warehouse.unitCost')}: <strong>{sar(unitCost(numbers))}</strong> · {t('warehouse.totalCost')}: <strong>{sar(totalCost(numbers))}</strong>
        <small className="block text-slate-500">{t('warehouse.perPieceNote')}</small>
      </p>
      <Field label={t('common.notes')}>
        <Input value={values.notes} onChange={(e) => set('notes')(e.target.value)} />
      </Field>
      <FormActions saving={saving} onCancel={onCancel} />
    </form>
  )
}
