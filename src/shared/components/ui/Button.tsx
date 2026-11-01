import clsx from 'clsx'
import type { LucideIcon } from 'lucide-react'
import type { ButtonHTMLAttributes } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'dangerSolid' | 'ghost' | 'link'
export type ButtonSize = 'md' | 'sm'

const base =
  'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl border font-medium transition ' +
  'focus:outline-none focus-visible:ring-4 focus-visible:ring-primary-600/20 disabled:cursor-default disabled:opacity-60'

const variants: Record<ButtonVariant, string> = {
  primary: 'border-primary-600 bg-primary-600 font-semibold text-white hover:bg-primary-700',
  secondary: 'border-slate-200 bg-white text-slate-900 hover:bg-slate-50 hover:shadow-card',
  danger: 'border-rose-200 bg-white text-rose-600 hover:bg-rose-50',
  dangerSolid: 'border-rose-600 bg-rose-600 font-semibold text-white hover:bg-rose-700',
  ghost: 'border-transparent bg-transparent text-slate-600 hover:bg-slate-100',
  link: 'border-transparent bg-transparent !p-0 font-bold text-primary-700 hover:underline'
}

const sizes: Record<ButtonSize, string> = {
  md: 'px-4 py-2',
  sm: 'px-3 py-1.5 text-sm'
}

/** كلاسات الزر لوحدها: تنفع تستخدمها على <Link> أو أي عنصر تاني */
export const buttonClass = (variant: ButtonVariant = 'secondary', size: ButtonSize = 'md', className?: string): string =>
  clsx(base, variants[variant], sizes[size], className)

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  /** أيقونة lucide قبل النص */
  icon?: LucideIcon
}

export function Button({ variant = 'secondary', size = 'md', icon: Icon, className, type = 'button', children, ...props }: ButtonProps) {
  return (
    <button type={type} className={buttonClass(variant, size, className)} {...props}>
      {Icon && <Icon className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} aria-hidden="true" />}
      {children}
    </button>
  )
}
