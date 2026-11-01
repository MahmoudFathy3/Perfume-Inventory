import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from './Button'

interface FormActionsProps {
  saving?: boolean
  onCancel: () => void
  /** نص زرار الحفظ (الافتراضي: حفظ) */
  submitLabel?: string
}

/** زرار حفظ + إلغاء (أخطاء الحفظ بتظهر كـ toast) */
export function FormActions({ saving, onCancel, submitLabel }: FormActionsProps) {
  const { t } = useTranslation()
  return (
    <div className="mt-4 flex gap-2">
      <Button type="submit" variant="primary" icon={Check} disabled={saving}>
        {submitLabel ?? t('common.save')}
      </Button>
      <Button onClick={onCancel}>{t('common.cancel')}</Button>
    </div>
  )
}
