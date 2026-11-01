import clsx from 'clsx'
import type { ReactNode } from 'react'

interface FieldProps {
  label: ReactNode
  hint?: ReactNode
  className?: string
  children: ReactNode
}

/** عنوان + حقل (+ ملاحظة تحته) */
export function Field({ label, hint, className, children }: FieldProps) {
  return (
    <label className={clsx('mb-3.5 flex flex-col gap-1.5', className)}>
      <span className="text-[13px] font-semibold text-slate-500">{label}</span>
      {children}
      {hint && <small className="text-rose-600">{hint}</small>}
    </label>
  )
}
