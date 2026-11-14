import type { LucideIcon } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useToast } from '../../toast/ToastProvider'
import { Button, Modal } from '../ui'

interface ConfirmActionDialogProps {
  title: string
  /** سؤال التأكيد */
  question: ReactNode
  /** العنصر اللي هيتعمل عليه الإجراء (مثلًا رقم الفاتورة والعميل) */
  detail?: ReactNode
  /** اللي هيحصل بعد التأكيد (نقط) */
  effects?: ReactNode[]
  confirmLabel: string
  icon?: LucideIcon
  /** danger = إجراء خطر (أحمر) */
  tone?: 'primary' | 'danger'
  /** الإجراء نفسه: لو رمى خطأ بيظهر toast والنافذة بتفضل مفتوحة */
  onConfirm: () => Promise<unknown>
  onCancel: () => void
}

/** نافذة تأكيد لأي إجراء (بدل window.confirm): سؤال، والعنصر، واللي هيحصل، وزرار تأكيد وإلغاء */
export function ConfirmActionDialog({ title, question, detail, effects = [], confirmLabel, icon, tone = 'primary', onConfirm, onCancel }: ConfirmActionDialogProps) {
  const { t } = useTranslation()
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  async function confirm() {
    setBusy(true)
    try {
      await onConfirm()
    } catch (e) {
      toast.fail(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={title} onClose={onCancel}>
      <p className="mb-2 mt-1 text-base">{question}</p>
      {detail && <p className="mb-3 rounded-xl bg-slate-100 px-3 py-2.5 font-bold">{detail}</p>}
      {effects.length > 0 && (
        <ul className="mb-1 flex list-disc flex-col gap-1.5 ps-5 text-sm text-slate-600 marker:text-slate-400">
          {effects.map((effect, i) => (
            <li key={i}>{effect}</li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex gap-2">
        <Button variant={tone === 'danger' ? 'dangerSolid' : 'primary'} icon={icon} onClick={() => void confirm()} disabled={busy}>
          {busy ? t('common.loading') : confirmLabel}
        </Button>
        <Button onClick={onCancel} disabled={busy}>{t('common.cancel')}</Button>
      </div>
    </Modal>
  )
}
