import { useTranslation } from 'react-i18next'
import Select from 'react-select'
import CreatableSelect from 'react-select/creatable'
import { getLanguage } from '@/i18n/languages'
import { createSelectStyles } from '@/shared/components/data/selectStyles'
import { normalizeArabic, sameText } from '@/shared/utils/normalizeArabic'

interface TypeOption {
  value: string
  label: string
  __isNew__?: boolean
}

const styles = createSelectStyles<TypeOption>()

interface ExpenseTypeSelectProps {
  /** الأنواع اللي اتسجلت قبل كده في المخزن ده (من الداتا بيز، مفيش قايمة ثابتة) */
  types: string[]
  value: string
  onChange: (value: string) => void
  /** true: تقدر تكتب نوع جديد من نفس القايمة (الفورم). false: اختيار من الموجود بس (الفلتر) */
  creatable?: boolean
  placeholder?: string
}

/** نوع المصروف بالبحث (من غير تفرقة همزة/تاء مربوطة). في الفورم النوع الجديد بيتضاف من نفس القايمة. */
export function ExpenseTypeSelect({ types, value, onChange, creatable = false, placeholder }: ExpenseTypeSelectProps) {
  const { t, i18n } = useTranslation()
  // النوع الجديد اللي لسه متسجلش بيظهر مختار لحد ما المصروف يتحفظ
  const all = value && !types.some((type) => sameText(type, value)) ? [value, ...types] : types
  const options: TypeOption[] = all.map((type) => ({ value: type, label: type }))
  const selected = options.find((o) => o.value === value) ?? null

  const common = {
    classNamePrefix: 'rs',
    options,
    value: selected,
    isClearable: true,
    isRtl: getLanguage(i18n.language).dir === 'rtl',
    placeholder: placeholder ?? t('common.choose'),
    noOptionsMessage: () => t('expenses.noTypes'),
    filterOption: (option: { data: TypeOption }, input: string) => !!option.data.__isNew__ || !input || normalizeArabic(option.data.label).includes(normalizeArabic(input)),
    menuPortalTarget: document.body,
    menuPosition: 'fixed' as const,
    styles
  }

  if (!creatable) return <Select<TypeOption, false> {...common} onChange={(option) => onChange(option?.value ?? '')} />

  return (
    <CreatableSelect<TypeOption, false>
      {...common}
      onChange={(option) => onChange(option?.value ?? '')}
      onCreateOption={(input) => onChange(input.trim())}
      isValidNewOption={(input) => input.trim() !== '' && !all.some((type) => sameText(type, input))}
      formatCreateLabel={(input) => t('expenses.createType', { name: input.trim() })}
    />
  )
}
