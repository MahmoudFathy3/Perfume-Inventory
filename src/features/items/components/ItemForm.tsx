import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Category, Condition, Item, StockInput } from '@shared/types'
import { OptionSelect } from '@/shared/components/data/OptionSelect'
import { Field, FormActions, Input, NumberInput } from '@/shared/components/ui'
import { CONDITIONS } from '@/shared/constants'
import { useSubmit } from '@/shared/hooks/useSubmit'
import clsx from 'clsx'

type StockState = Record<keyof StockInput, string>

const stockFields: { key: keyof StockInput; label: string; step?: string }[] = [
  { key: 'quantity', label: 'common.quantity', step: '1' },
  { key: 'purchase_price', label: 'items.purchasePrice' },
  { key: 'selling_price', label: 'items.sellingPrice' },
  { key: 'wholesale_price', label: 'items.wholesalePrice' }
]

const boxTone: Record<Condition, string> = {
  new: 'border-green-200 bg-green-50 text-green-800',
  damaged: 'border-orange-200 bg-orange-50 text-orange-800'
}

const stockOf = (item: Item | null, cond: Condition): StockState => ({
  quantity: String(item?.[`${cond}_quantity`] ?? 0),
  purchase_price: String(item?.[`${cond}_purchase_price`] ?? 0),
  selling_price: String(item?.[`${cond}_selling_price`] ?? 0),
  wholesale_price: String(item?.[`${cond}_wholesale_price`] ?? 0)
})

/** قسم المخزون لحالة واحدة (جديد أو تالف): الكمية + سعر الشراء + سعر البيع + سعر الجملة */
function StockBox({ condition, values, onChange }: { condition: Condition; values: StockState; onChange: (v: StockState) => void }) {
  const { t } = useTranslation()
  return (
    <div className={clsx('mt-3 rounded-xl border px-3.5 pb-0.5 pt-3', boxTone[condition])}>
      <h4 className="mb-2.5 text-sm font-bold">{t(`condition.${condition}`)}</h4>
      <div className="grid grid-cols-4 gap-x-3 text-slate-900">
        {stockFields.map((f) => (
          <Field key={f.key} label={t(f.label)}>
            <NumberInput step={f.step} value={values[f.key]} onChange={(e) => onChange({ ...values, [f.key]: e.target.value })} />
          </Field>
        ))}
      </div>
    </div>
  )
}

interface ItemFormProps {
  initial: Item | null
  categories: Category[]
  onSubmit: (values: { name_ar: string; name_en: string; category_id: number | null; stock: Record<Condition, StockInput> }) => Promise<unknown>
  onCancel: () => void
}

/** فورم واحد للمنتج: الاسمين + الصنف (Select) + مخزون الجديد + مخزون التالف */
export function ItemForm({ initial, categories, onSubmit, onCancel }: ItemFormProps) {
  const { t } = useTranslation()
  const [v, setV] = useState({ name_ar: initial?.name_ar ?? '', name_en: initial?.name_en ?? '', category_id: (initial?.category_id ?? '') as number | '' })
  const [stock, setStock] = useState<Record<Condition, StockState>>({ new: stockOf(initial, 'new'), damaged: stockOf(initial, 'damaged') })

  const { submit, saving } = useSubmit(() =>
    onSubmit({ name_ar: v.name_ar, name_en: v.name_en, category_id: v.category_id || null, stock })
  )

  return (
    <form onSubmit={submit}>
      <div className="grid grid-cols-2 gap-x-4">
        <Field label={t('items.nameAr')}>
          <Input value={v.name_ar} onChange={(e) => setV({ ...v, name_ar: e.target.value })} autoFocus />
        </Field>
        <Field label={t('items.nameEn')}>
          <Input value={v.name_en} onChange={(e) => setV({ ...v, name_en: e.target.value })} dir="ltr" />
        </Field>
      </div>

      <Field label={t('categories.category')} hint={categories.length === 0 ? t('items.noCategories') : undefined}>
        <OptionSelect
          options={categories.map((c) => ({ value: c.id, label: c.name }))}
          value={v.category_id}
          onChange={(category_id) => setV({ ...v, category_id })}
          placeholder={t('items.chooseCategory')}
        />
      </Field>

      {CONDITIONS.map((cond) => (
        <StockBox key={cond} condition={cond} values={stock[cond]} onChange={(x) => setStock({ ...stock, [cond]: x })} />
      ))}

      <FormActions saving={saving} onCancel={onCancel} />
    </form>
  )
}
