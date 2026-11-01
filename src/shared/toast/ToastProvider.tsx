import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import clsx from 'clsx'
import { CheckCircle2, Info, X, XCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { errorText } from '../utils/format'

type ToastKind = 'success' | 'error' | 'info'

interface ToastItem {
  id: number
  kind: ToastKind
  text: string
}

interface ToastApi {
  success: (text: string) => void
  info: (text: string) => void
  error: (text: string) => void
  /** خطأ جاي من الـ backend: بيتترجم من كوده (مثلًا OUT_OF_STOCK) */
  fail: (error: unknown) => void
}

const ToastContext = createContext<ToastApi | null>(null)

const DURATION: Record<ToastKind, number> = { success: 3500, info: 3500, error: 6000 }

const STYLES: Record<ToastKind, { icon: LucideIcon; box: string; iconColor: string }> = {
  success: { icon: CheckCircle2, box: 'border-green-500', iconColor: 'text-green-600' },
  error: { icon: XCircle, box: 'border-rose-500', iconColor: 'text-rose-600' },
  info: { icon: Info, box: 'border-primary-600', iconColor: 'text-primary-600' }
}

/** رسائل منبثقة (Toast) لنتيجة أي إجراء: نجاح، أو خطأ، أو معلومة. بتختفي لوحدها. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((x) => x.id !== id)), [])

  const push = useCallback(
    (kind: ToastKind, text: string) => {
      const id = Date.now() + Math.random()
      setToasts((list) => [...list.slice(-3), { id, kind, text }]) // آخر 4 رسائل بس
      setTimeout(() => dismiss(id), DURATION[kind])
    },
    [dismiss]
  )

  const api = useMemo<ToastApi>(
    () => ({
      success: (text) => push('success', text),
      info: (text) => push('info', text),
      error: (text) => push('error', text),
      fail: (error) => push('error', errorText(t, error))
    }),
    [push, t]
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-6 z-[2000] flex flex-col items-center gap-2.5 px-4">
        {toasts.map((toast) => {
          const { icon: Icon, box, iconColor } = STYLES[toast.kind]
          return (
            <div
              key={toast.id}
              role={toast.kind === 'error' ? 'alert' : 'status'}
              className={clsx('pointer-events-auto flex min-w-[360px] max-w-[640px] animate-toast-in items-center gap-3.5 rounded-2xl border-s-[6px] bg-white px-5 py-4 shadow-pop', box)}
            >
              <Icon className={clsx('h-7 w-7 shrink-0', iconColor)} />
              <span className="flex-1 text-base font-semibold text-slate-800">{toast.text}</span>
              <button type="button" onClick={() => dismiss(toast.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label={t('common.close')}>
                <X className="h-5 w-5" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
