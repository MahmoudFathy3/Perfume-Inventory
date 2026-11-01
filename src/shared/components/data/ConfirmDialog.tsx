import { Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Button, Modal } from '../ui'

interface ConfirmDialogProps {
  /** اسم العنصر اللي هيتحذف */
  detail?: ReactNode
  /** ملاحظة إضافية (مثلًا: هيتم إخفاؤه لو مرتبط بفواتير) */
  note?: ReactNode
  /** تحذير (مثلًا: عنده كمية في المخزن) */
  warning?: ReactNode
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** نافذة تأكيد الحذف (بدل window.confirm). أخطاء الحذف بتظهر كـ toast. */
export function ConfirmDialog({ detail, note, warning, busy, onConfirm, onCancel }: ConfirmDialogProps) {
  const { t } = useTranslation()
  return (
    <Modal title={t('common.confirmDeleteTitle')} onClose={onCancel}>
      <p className="mb-2 mt-1 text-base">{t('common.confirmDelete')}</p>
      {detail && <p className="mb-2 rounded-xl bg-slate-100 px-3 py-2.5 font-bold">{detail}</p>}
      {note && <p className="text-sm text-slate-500">{note}</p>}
      {warning && <Alert tone="warning">{warning}</Alert>}
      <p className="mt-2 text-sm text-slate-500">{t('common.deleteWarning')}</p>
      <div className="mt-4 flex gap-2">
        <Button variant="dangerSolid" icon={Trash2} onClick={onConfirm} disabled={busy}>
          {busy ? t('common.deleting') : t('common.yesDelete')}
        </Button>
        <Button onClick={onCancel}>{t('common.cancel')}</Button>
      </div>
    </Modal>
  )
}
