import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { SettingKey } from '@shared/types'
import { Button, Field, Input } from '@/shared/components/ui'
import { useSubmit } from '@/shared/hooks/useSubmit'
import { useToast } from '@/shared/toast/ToastProvider'
import { settingsApi } from '../api/settings.api'

const FIELDS: { key: Extract<SettingKey, `shop_${string}`>; label: string }[] = [
  { key: 'shop_name', label: 'settings.shopName' },
  { key: 'shop_phone', label: 'settings.shopPhone' },
  { key: 'shop_address', label: 'settings.shopAddress' }
]

/** بيانات المحل اللي بتظهر على الفاتورة المطبوعة */
export function ShopInfoForm({ onSaved }: { onSaved?: () => void }) {
  const { t } = useTranslation()
  const toast = useToast()
  const [values, setValues] = useState<Record<string, string>>({ shop_name: '', shop_phone: '', shop_address: '' })

  useEffect(() => {
    void settingsApi.all().then((all) => setValues({ shop_name: all.shop_name ?? '', shop_phone: all.shop_phone ?? '', shop_address: all.shop_address ?? '' }))
  }, [])

  const { submit, saving } = useSubmit(async () => {
    for (const f of FIELDS) await settingsApi.set(f.key, values[f.key])
    toast.success(t('toast.saved'))
    onSaved?.()
  })

  return (
    <form onSubmit={submit}>
      {FIELDS.map((f) => (
        <Field key={f.key} label={t(f.label)}>
          <Input value={values[f.key]} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
        </Field>
      ))}
      <Button type="submit" variant="primary" disabled={saving}>{t('settings.saveShop')}</Button>
    </form>
  )
}
