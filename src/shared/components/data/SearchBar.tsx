import { useTranslation } from 'react-i18next'
import { Input } from '../ui'

export function SearchBar({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { t } = useTranslation()
  return (
    <Input
      type="search"
      value={value}
      placeholder={t('common.searchPlaceholder')}
      aria-label={t('common.search')}
      className="w-[280px]"
      onChange={(e) => onChange(e.target.value)}
    />
  )
}
