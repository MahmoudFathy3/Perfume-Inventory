import { useState } from 'react'
import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button, Card, Modal } from '@/shared/components/ui'

interface SettingsSectionProps {
  icon: LucideIcon
  title: string
  description: string
  /** محتوى النافذة: بياخد دالة القفل عشان يقفلها بعد الحفظ لو حب */
  children: (close: () => void) => ReactNode
}

/** قسم في الإعدادات بيظهر كعنوان ووصف وزرار، ومحتواه بيفتح في نافذة (Modal) */
export function SettingsSection({ icon: Icon, title, description, children }: SettingsSectionProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)
  return (
    <Card className="flex items-center gap-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <h2>{title}</h2>
        <p className="text-sm text-slate-500">{description}</p>
      </div>
      <Button onClick={() => setOpen(true)}>{t('settings.open')}</Button>
      {open && <Modal title={title} onClose={close}>{children(close)}</Modal>}
    </Card>
  )
}
