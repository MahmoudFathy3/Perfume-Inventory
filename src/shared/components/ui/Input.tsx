import clsx from 'clsx'
import { Eye, EyeOff } from 'lucide-react'
import { forwardRef, useState } from 'react'
import type { InputHTMLAttributes, SelectHTMLAttributes } from 'react'
import { useTranslation } from 'react-i18next'

export const inputClass =
  'w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400 ' +
  'focus:border-primary-600 focus:outline-none focus:ring-4 focus:ring-primary-600/20 disabled:bg-slate-50'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={clsx(inputClass, className)} {...props} />
})

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, ...props }, ref) {
  return <select ref={ref} className={clsx(inputClass, 'min-w-[100px]', className)} {...props} />
})

/** خانة كلمة سر بزرار عين يظهرها / يخفيها (الزرار في آخر الخانة حسب اتجاه اللغة) */
export const PasswordInput = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>>(function PasswordInput({ className, ...props }, ref) {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(false)
  const Icon = visible ? EyeOff : Eye
  const label = t(visible ? 'common.hidePassword' : 'common.showPassword')
  return (
    <div className="relative">
      <input ref={ref} type={visible ? 'text' : 'password'} className={clsx(inputClass, 'pe-10', className)} {...props} />
      <button
        type="button"
        tabIndex={-1}
        aria-label={label}
        title={label}
        aria-pressed={visible}
        disabled={props.disabled}
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 end-0 flex w-10 items-center justify-center rounded-e-xl text-slate-400 hover:text-slate-700 disabled:opacity-50"
      >
        <Icon size={18} />
      </button>
    </div>
  )
})

/** خانة رقم: بتختار كل الرقم لما تدوس عليها، وبتقبل أي رقم عشري */
export function NumberInput({ className, step = 'any', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <Input type="number" min={0} step={step} onFocus={(e) => e.target.select()} className={clsx('min-w-[84px]', className)} {...props} />
}
