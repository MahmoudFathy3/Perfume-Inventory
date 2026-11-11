import { createContext, useContext, useMemo } from 'react'
import type { ReactNode } from 'react'
import clsx from 'clsx'
import { CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Slide, toast, ToastContainer } from 'react-toastify'
import type { CloseButtonProps, ToastContentProps, TypeOptions } from 'react-toastify'
import { getLanguage } from '@/i18n/languages'
import { errorText } from '../utils/format'

interface ToastApi {
  success: (text: string) => void
  info: (text: string) => void
  error: (text: string) => void
  /** خطأ جاي من الـ backend: بيتترجم من كوده (مثلًا OUT_OF_STOCK) */
  fail: (error: unknown) => void
}

const ToastContext = createContext<ToastApi | null>(null)

/** مدة كل نوع (الخطأ أطول علشان يتقري) */
const DURATION = { success: 3500, info: 3500, error: 6000 } as const

/** شكل كل نوع بتصميم البرنامج: لون الخط الجانبي والأيقونة */
const STYLES: Partial<Record<TypeOptions, { border: string; icon: ReactNode }>> = {
  success: { border: '!border-green-500', icon: <CheckCircle2 className="h-7 w-7 text-green-600" /> },
  error: { border: '!border-rose-500', icon: <XCircle className="h-7 w-7 text-rose-600" /> },
  info: { border: '!border-primary-600', icon: <Info className="h-7 w-7 text-primary-600" /> }
}

function CloseButton({ closeToast, ariaLabel }: CloseButtonProps) {
  return (
    // order-last + ms-auto: دايمًا في آخر الرسالة (الشمال في العربي، واليمين في الإنجليزي)
    <button type="button" onClick={closeToast} aria-label={ariaLabel} className="order-last ms-auto shrink-0 self-center rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
      <X className="h-5 w-5" />
    </button>
  )
}

/** نص الرسالة (react-toastify بيمرر props للمكوّن، والنص في data) */
const Message = ({ data }: ToastContentProps<string>) => <span className="text-base font-semibold text-slate-800">{data}</span>

/**
 * رسائل منبثقة (Toast) لنتيجة أي إجراء: نجاح، أو خطأ، أو معلومة. بتختفي لوحدها، وبتقف لو الماوس عليها.
 * مبنية على react-toastify بشكل البرنامج، وباقي البرنامج بيستخدم useToast() بس (success / info / error / fail).
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const { t, i18n } = useTranslation()

  const api = useMemo<ToastApi>(() => {
    const show = (type: 'success' | 'info' | 'error', text: string) =>
      toast(Message, { data: text, type, autoClose: DURATION[type], role: type === 'error' ? 'alert' : 'status' })
    return {
      success: (text) => show('success', text),
      info: (text) => show('info', text),
      error: (text) => show('error', text),
      fail: (error) => show('error', errorText(t, error))
    }
  }, [t])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastContainer
        position="bottom-left"
        rtl={getLanguage(i18n.language).dir === 'rtl'}
        limit={4}
        newestOnTop
        closeOnClick={false}
        pauseOnHover
        draggable={false}
        hideProgressBar
        transition={Slide}
        icon={({ type }) => STYLES[type]?.icon}
        closeButton={(props) => <CloseButton {...props} ariaLabel={t('common.close')} />}
        className="!w-auto !max-w-[94vw]"
        toastClassName={(ctx) =>
          clsx(
            ctx?.defaultClassName,
            '!min-h-0 !w-auto min-w-[360px] max-w-[640px] !items-center !gap-3.5 !rounded-2xl !border-s-[6px] !bg-white !px-5 !py-4 !font-[inherit] !shadow-pop',
            STYLES[ctx?.type ?? 'info']?.border
          )
        }
      />
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
