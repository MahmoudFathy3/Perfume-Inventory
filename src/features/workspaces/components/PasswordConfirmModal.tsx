import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Field, Modal, PasswordInput } from '@/shared/components/ui'
import { useSubmit } from '@/shared/hooks/useSubmit'

interface PasswordConfirmModalProps {
  title: string
  /** اسم الشراكة أو أي تفاصيل تانية تحت العنوان */
  detail?: string
  /** ملاحظة صغيرة تحت التفاصيل */
  note?: string
  confirmLabel: string
  /** زرار التأكيد أحمر (للحذف) */
  danger?: boolean
  /** بتعمل العملية بكلمة السر. لو رمت خطأ (مثلًا كلمة السر غلط) النافذة بتفضل مفتوحة. */
  onConfirm: (password: string) => Promise<unknown>
  onCancel: () => void
}

/** نافذة بتطلب كلمة سر التطبيق قبل عملية حساسة */
export function PasswordConfirmModal({ title, detail, note, confirmLabel, danger = false, onConfirm, onCancel }: PasswordConfirmModalProps) {
  const { t } = useTranslation()
  const [password, setPassword] = useState('')
  const { submit, saving } = useSubmit(async () => {
    try {
      await onConfirm(password)
    } catch (e) {
      setPassword('')
      throw e
    }
  })

  return (
    <Modal title={title} onClose={onCancel}>
      <form onSubmit={submit}>
        {detail && <p className="mb-3 font-semibold">{detail}</p>}
        {note && <p className="mb-3 text-sm text-slate-500">{note}</p>}
        <Field label={t('workspaces.passwordPrompt')}>
          <PasswordInput autoComplete="current-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button onClick={onCancel}>{t('common.cancel')}</Button>
          <Button type="submit" variant={danger ? 'dangerSolid' : 'primary'} disabled={saving || !password}>{confirmLabel}</Button>
        </div>
      </form>
    </Modal>
  )
}
