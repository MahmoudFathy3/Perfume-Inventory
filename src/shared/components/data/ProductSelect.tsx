import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import Select from 'react-select'
import CreatableSelect from 'react-select/creatable'
import type { Item } from '@shared/types'
import { getLanguage } from '@/i18n/languages'
import { bilingualName } from '../../utils/format'
import { normalizeArabic, sameText } from '../../utils/normalizeArabic'
import { createSelectStyles } from './selectStyles'

interface ProductOption {
  value: number | string
  label: string
  item?: Item
  search?: string
  __isNew__?: boolean
}

export interface ProductValue {
  item_id: number | ''
  /** اسم منتج جديد لسه ما اتعملش (في المشتريات بس) */
  name: string
  /** اسم يتعرض لو المنتج مش في القايمة (مؤرشف وهو في فاتورة قديمة بتتعدّل) */
  label?: string
}

const styles = createSelectStyles<ProductOption>()

interface ProductSelectProps {
  items: Item[]
  value: ProductValue
  onChange: (value: ProductValue) => void
  /** true (في المشتريات): بيظهر خيار "إضافة منتج جديد" لو الاسم مش موجود */
  allowCreate?: boolean
}

/** Select بالبحث للمنتج. الاسم في القائمة «عربي - English» والبحث بيتجاهل الهمزة والتاء المربوطة. */
export function ProductSelect({ items, value, onChange, allowCreate = false }: ProductSelectProps) {
  const { t, i18n } = useTranslation()
  const isRtl = getLanguage(i18n.language).dir === 'rtl'

  const options = useMemo<ProductOption[]>(
    () =>
      items.map((item) => ({
        value: item.id,
        label: bilingualName(item),
        item,
        search: normalizeArabic(`${item.name_ar} ${item.name_en ?? ''} ${item.category_name}`)
      })),
    [items]
  )

  const selected: ProductOption | null = value.item_id
    ? (options.find((o) => o.value === value.item_id) ?? (value.label ? { value: value.item_id, label: value.label } : null))
    : value.name
      ? { value: '__new__', label: value.name }
      : null

  const handleChange = (option: ProductOption | null) => {
    if (!option) return onChange({ item_id: '', name: '' })
    if (option.__isNew__) return onChange({ item_id: '', name: String(option.value) })
    onChange({ item_id: Number(option.value), name: '' })
  }

  const common = {
    classNamePrefix: 'rs',
    options,
    value: selected,
    onChange: handleChange,
    isClearable: true,
    isRtl,
    placeholder: t('common.choose'),
    noOptionsMessage: () => t('common.noData'),
    filterOption: (option: { data: ProductOption }, input: string) =>
      !!option.data.__isNew__ || !input || (option.data.search ?? '').includes(normalizeArabic(input)),
    formatOptionLabel: (option: ProductOption, meta: { context: 'menu' | 'value' }) => {
      if (meta.context === 'menu' && option.item) {
        const i = option.item
        return (
          <div className="flex flex-col leading-snug">
            <span>{option.label}</span>
            <small className="opacity-75">
              {i.category_name} · {t('sales.available')}: {t('condition.new')} {i.new_quantity} / {t('condition.damaged')} {i.damaged_quantity}
            </small>
          </div>
        )
      }
      return option.label
    },
    menuPortalTarget: document.body,
    menuPosition: 'fixed' as const,
    styles
  }

  if (!allowCreate) return <Select<ProductOption, false> {...common} />

  return (
    <CreatableSelect<ProductOption, false>
      {...common}
      isValidNewOption={(input) => input.trim() !== '' && !items.some((i) => sameText(i.name_ar, input) || sameText(i.name_en, input))}
      formatCreateLabel={(input) => t('purchases.createProduct', { name: input })}
    />
  )
}
