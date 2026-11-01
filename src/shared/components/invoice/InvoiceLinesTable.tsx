import { Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Category, Item } from '@shared/types'
import { Button, Input, NumberInput, Select } from '../ui'
import { ProductSelect } from '../data/ProductSelect'
import { OptionSelect } from '../data/OptionSelect'
import type { InvoiceKind, InvoiceLines, LineState } from './useInvoiceLines'

interface InvoiceLinesTableProps {
  kind: InvoiceKind
  items: Item[]
  categories?: Category[]
  state: InvoiceLines
}

const th = 'border-b border-slate-200 bg-slate-50 px-3 py-2.5 text-start text-xs font-bold text-slate-500'
const td = 'px-3 py-2 align-top'

/** منتج جديد في فاتورة الشراء: بنطلب صنفه (والاسم الإنجليزي اختياري) */
function NewProductFields({ line, index, categories, state }: { line: LineState; index: number; categories: Category[]; state: InvoiceLines }) {
  const { t } = useTranslation()
  return (
    <div className="bg-primary-50 px-3 py-3">
      <p className="mb-2 text-[13px] text-primary-800">{t('purchases.newProductHint')}</p>
      <div className="grid grid-cols-2 gap-3">
        <OptionSelect
          options={categories.map((c) => ({ value: c.id, label: c.name }))}
          value={line.category_id}
          onChange={(category_id) => state.update(index, { category_id })}
          placeholder={t('items.chooseCategory')}
        />
        <Input value={line.name_en} onChange={(e) => state.update(index, { name_en: e.target.value })} placeholder={t('items.nameEn')} dir="ltr" />
      </div>
    </div>
  )
}

/** جدول سطور فاتورة الشراء أو البيع: المنتج Select بالبحث + الحالة + الكمية + الأسعار */
export function InvoiceLinesTable({ kind, items, categories = [], state }: InvoiceLinesTableProps) {
  const { t } = useTranslation()
  const purchase = kind === 'purchase'
  const { lines } = state

  return (
    <>
      <table className="w-full border-separate border-spacing-0 overflow-hidden rounded-2xl bg-surface shadow-card">
        <thead>
          <tr>
            <th className={`${th} w-[34%]`}>{t('common.product')}</th>
            <th className={th}>{t('condition.label')}</th>
            <th className={th}>{t('common.quantity')}</th>
            {purchase && <th className={th}>{t('purchases.purchasePrice')}</th>}
            <th className={th}>{t(purchase ? 'purchases.sellingPrice' : 'sales.sellingPrice')}</th>
            {purchase && <th className={th}>{t('purchases.wholesalePrice')}</th>}
            <th className={th} />
          </tr>
        </thead>
        {lines.map((line, index) => {
          const item = state.findItem(line.item_id)
          const isNew = purchase && !line.item_id && line.name !== ''
          return (
            <tbody key={index} className="border-t border-slate-200 [&:not(:first-of-type)>tr:first-child>td]:border-t [&:not(:first-of-type)>tr:first-child>td]:border-slate-200">
              <tr>
                <td className={td}>
                  <ProductSelect items={items} allowCreate={purchase} value={{ item_id: line.item_id, name: line.name, label: line.label }} onChange={(v) => state.update(index, v)} />
                </td>
                <td className={td}>
                  <Select value={line.condition} onChange={(e) => state.update(index, { condition: e.target.value as LineState['condition'] })}>
                    <option value="new">{t('condition.new')}</option>
                    <option value="damaged">{t('condition.damaged')}</option>
                  </Select>
                </td>
                <td className={td}>
                  <NumberInput min={1} step={1} value={line.quantity} onChange={(e) => state.update(index, { quantity: e.target.value })} />
                  {!purchase && item && (
                    <small className="mt-1 block text-slate-500">
                      {t('sales.available')}: {item[`${line.condition}_quantity`]}
                    </small>
                  )}
                </td>
                {purchase && (
                  <td className={td}><NumberInput value={line.purchase_price} onChange={(e) => state.update(index, { purchase_price: e.target.value })} /></td>
                )}
                <td className={td}><NumberInput value={line.selling_price} onChange={(e) => state.update(index, { selling_price: e.target.value })} /></td>
                {purchase && (
                  <td className={td}><NumberInput value={line.wholesale_price} onChange={(e) => state.update(index, { wholesale_price: e.target.value })} /></td>
                )}
                <td className={td}>
                  {lines.length > 1 && (
                    <Button variant="ghost" icon={Trash2} onClick={() => state.remove(index)} aria-label={t('common.removeLine')} />
                  )}
                </td>
              </tr>
              {isNew && (
                <tr>
                  <td colSpan={purchase ? 7 : 5}>
                    <NewProductFields line={line} index={index} categories={categories} state={state} />
                  </td>
                </tr>
              )}
            </tbody>
          )
        })}
      </table>
      <Button className="mt-3" icon={Plus} onClick={state.add}>{t(purchase ? 'purchases.addLine' : 'sales.addLine')}</Button>
    </>
  )
}
