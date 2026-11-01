import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Field, Input } from '@/shared/components/ui'
import { useSubmit } from '@/shared/hooks/useSubmit'
import { useToast } from '@/shared/toast/ToastProvider'
import { authApi } from '../api/auth.api'

const EMPTY = { current: '', next: '', confirm: '' }

/** تغيير كلمة السر (بيطلب الحالية). البيانات مش بتتشفّر من جديد: بس مفتاحها بيتغلّف بالكلمة الجديدة. */
export function ChangePasswordForm() {
  const { t } = useTranslation()
  const toast = useToast()
  const [values, setValues] = useState(EMPTY)
  const set = (key: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) => setValues({ ...values, [key]: e.target.value })
  const { submit, saving } = useSubmit(async () => {
    if (values.next !== values.confirm) throw new Error('PASSWORD_MISMATCH')
    await authApi.changePassword({ current: values.current, next: values.next })
    toast.success(t('auth.passwordChanged'))
    setValues(EMPTY)
  })

  return (
    <form onSubmit={submit}>
      <h3 className="mb-2 font-bold">{t('auth.changePassword')}</h3>
      <div>
        <Field label={t('auth.currentPassword')}>
          <Input type="password" autoComplete="current-password" value={values.current} onChange={set('current')} />
        </Field>
        <Field label={t('auth.newPassword')}>
          <Input type="password" autoComplete="new-password" value={values.next} onChange={set('next')} />
        </Field>
        <Field label={t('auth.confirmPassword')}>
          <Input type="password" autoComplete="new-password" value={values.confirm} onChange={set('confirm')} />
        </Field>
      </div>
      <Button type="submit" variant="primary" disabled={saving || !values.current || !values.next}>{t('auth.changePasswordAction')}</Button>
    </form>
  )
}
