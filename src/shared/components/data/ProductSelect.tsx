import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import Select from 'react-select'
import type { GroupBase } from 'react-select'
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
  /** اسم المخزن التاني لو المنتج منه (فاتورة فيها منتجات من مخزن تاني). null = مخزن الفاتورة */
  tagOf?: (item: Item) => string | null
  /** أقسام في القايمة (قسم لكل مخزن). لو موجودة بتحل محل items في العرض */
  groups?: { label: string; items: Item[] }[]
}

/** Select بالبحث للمنتج. الاسم في القائمة «عربي - English» والبحث بيتجاهل الهمزة والتاء المربوطة. */
export function ProductSelect({ items, value, onChange, allowCreate = false, tagOf, groups }: ProductSelectProps) {
  const { t, i18n } = useTranslation()
  const isRtl = getLanguage(i18n.language).dir === 'rtl'

  const toOption = useCallback(
    (item: Item): ProductOption => ({
      value: item.id,
      label: tagOf?.(item) ? `${bilingualName(item)} · ${tagOf(item)}` : bilingualName(item),
      item,
      search: normalizeArabic(`${item.name_ar} ${item.name_en ?? ''} ${item.category_name} ${tagOf?.(item) ?? ''}`)
    }),
    [tagOf]
  )
  // options = كل المنتجات (للبحث عن المختار)، و shown = اللي بيظهر في القايمة (بأقسام لو فيه أكتر من مخزن)
  const options = useMemo<ProductOption[]>(() => (groups ? groups.flatMap((g) => g.items) : items).map(toOption), [items, groups, toOption])
  const shown = useMemo<(ProductOption | GroupBase<ProductOption>)[]>(
    () => (groups ? groups.filter((g) => g.items.length > 0).map((g) => ({ label: g.label, options: g.items.map(toOption) })) : options),
    [groups, options, toOption]
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
    options: shown,
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
        const tag = tagOf?.(i)
        return (
          <div className="flex flex-col leading-snug">
            <span className="flex items-center gap-2">
              {bilingualName(i)}
              {tag && <span className="rounded-md bg-amber-100 px-1.5 text-[11px] font-bold text-amber-800">{tag}</span>}
            </span>
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
