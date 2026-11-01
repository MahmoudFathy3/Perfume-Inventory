import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import Select from 'react-select'
import { getLanguage } from '@/i18n/languages'
import { normalizeArabic } from '../../utils/normalizeArabic'
import { createSelectStyles } from './selectStyles'

export interface SelectOption {
  value: number
  label: string
}

const styles = createSelectStyles<SelectOption>()

interface OptionSelectProps {
  options: SelectOption[]
  value: number | ''
  onChange: (value: number | '') => void
  placeholder?: string
  isClearable?: boolean
}

/** Select بالبحث لاختيار عنصر من قايمة (مثلًا الصنف). البحث بيتجاهل الهمزة والتاء المربوطة. */
export function OptionSelect({ options, value, onChange, placeholder, isClearable = false }: OptionSelectProps) {
  const { t, i18n } = useTranslation()
  const searchable = useMemo(() => options.map((o) => ({ ...o, search: normalizeArabic(o.label) })), [options])
  const selected = options.find((o) => o.value === value) ?? null

  return (
    <Select<SelectOption, false>
      classNamePrefix="rs"
      options={searchable}
      value={selected}
      onChange={(option) => onChange(option ? option.value : '')}
      isClearable={isClearable}
      isRtl={getLanguage(i18n.language).dir === 'rtl'}
      placeholder={placeholder ?? t('common.choose')}
      noOptionsMessage={() => t('common.noData')}
      filterOption={(option, input) => !input || (option.data as SelectOption & { search: string }).search.includes(normalizeArabic(input))}
      menuPortalTarget={document.body}
      menuPosition="fixed"
      styles={styles}
    />
  )
}
