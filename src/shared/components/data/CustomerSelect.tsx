import { useTranslation } from 'react-i18next'
import CreatableSelect from 'react-select/creatable'
import type { Customer } from '@shared/types'
import { getLanguage } from '@/i18n/languages'
import { useToast } from '../../toast/ToastProvider'
import { normalizeArabic, sameText } from '../../utils/normalizeArabic'
import { customerLabel } from '../../utils/partyName'
import { createSelectStyles } from './selectStyles'

interface CustomerOption {
  value: number | string
  label: string
  search?: string
  __isNew__?: boolean
}

const styles = createSelectStyles<CustomerOption>()

interface CustomerSelectProps {
  customers: Customer[]
  value: number | ''
  onChange: (value: number | '') => void
  /** بيعمل عميل جديد (من نفس القايمة) وبيرجّع الـ id بتاعه */
  onCreate: (name: string) => Promise<number>
}

/** اختيار العميل بالبحث، وإضافة عميل جديد من نفس القايمة لو مش موجود (الاسم مينفعش يتكرر). */
export function CustomerSelect({ customers, value, onChange, onCreate }: CustomerSelectProps) {
  const { t, i18n } = useTranslation()
  const toast = useToast()

  const options: CustomerOption[] = customers.map((c) => ({
    value: c.id,
    label: c.phone ? `${customerLabel(c.name, c.is_partner, t)} — ${c.phone}` : customerLabel(c.name, c.is_partner, t),
    search: normalizeArabic(`${c.name} ${c.phone ?? ''}`)
  }))

  async function create(name: string) {
    try {
      onChange(await onCreate(name.trim()))
    } catch (e) {
      toast.fail(e)
    }
  }

  return (
    <CreatableSelect<CustomerOption, false>
      classNamePrefix="rs"
      options={options}
      value={options.find((o) => o.value === value) ?? null}
      onChange={(option) => onChange(option && !option.__isNew__ ? Number(option.value) : '')}
      onCreateOption={create}
      isClearable
      isRtl={getLanguage(i18n.language).dir === 'rtl'}
      placeholder={t('sales.customerPlaceholder')}
      noOptionsMessage={() => t('common.noData')}
      filterOption={(option, input) => !!option.data.__isNew__ || !input || (option.data.search ?? '').includes(normalizeArabic(input))}
      isValidNewOption={(input) => input.trim() !== '' && !customers.some((c) => sameText(c.name, input))}
      formatCreateLabel={(input) => t('sales.createCustomer', { name: input })}
      menuPortalTarget={document.body}
      menuPosition="fixed"
      styles={styles}
    />
  )
}
