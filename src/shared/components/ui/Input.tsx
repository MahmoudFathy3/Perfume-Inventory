import clsx from 'clsx'
import { forwardRef } from 'react'
import type { InputHTMLAttributes, SelectHTMLAttributes } from 'react'

export const inputClass =
  'w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400 ' +
  'focus:border-primary-600 focus:outline-none focus:ring-4 focus:ring-primary-600/20 disabled:bg-slate-50'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={clsx(inputClass, className)} {...props} />
})

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, ...props }, ref) {
  return <select ref={ref} className={clsx(inputClass, 'min-w-[100px]', className)} {...props} />
})

/** خانة رقم: بتختار كل الرقم لما تدوس عليها، وبتقبل أي رقم عشري */
export function NumberInput({ className, step = 'any', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <Input type="number" min={0} step={step} onFocus={(e) => e.target.select()} className={clsx('min-w-[84px]', className)} {...props} />
}
