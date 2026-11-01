import clsx from 'clsx'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from './Button'

interface ModalProps {
  title: ReactNode
  onClose: () => void
  /** wide: نافذة عريضة للفواتير والفورمات الكبيرة */
  wide?: boolean
  children: ReactNode
}

export function Modal({ title, onClose, wide = false, children }: ModalProps) {
  const { t } = useTranslation()
  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-slate-900/50 backdrop-blur-[2px]" onMouseDown={onClose}>
      <div
        className={clsx('max-h-[92vh] max-w-[94vw] overflow-auto rounded-2xl bg-white px-4 py-4 shadow-pop xl:px-6 xl:py-5', wide ? 'w-[1040px]' : 'w-[480px]')}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="mb-3.5 flex items-center justify-between border-b border-slate-200 pb-3">
          <h2>{title}</h2>
          <Button variant="ghost" icon={X} onClick={onClose} aria-label={t('common.close')} />
        </header>
        {children}
      </div>
    </div>
  )
}
