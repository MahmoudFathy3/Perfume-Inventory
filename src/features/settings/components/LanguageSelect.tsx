import { useTranslation } from 'react-i18next'
import { LANGUAGES } from '@/i18n/languages'
import { Field, Select } from '@/shared/components/ui'
import { useLanguage } from '@/shared/hooks/useLanguage'

export function LanguageSelect() {
  const { t } = useTranslation()
  const { language, setLanguage } = useLanguage()
  return (
    <Field label={t('settings.language')}>
      <Select value={language} onChange={(e) => setLanguage(e.target.value)}>
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code} disabled={l.disabled}>{l.label}</option>
        ))}
      </Select>
    </Field>
  )
}
