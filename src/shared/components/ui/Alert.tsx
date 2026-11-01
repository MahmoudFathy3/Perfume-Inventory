import clsx from 'clsx'
import type { ReactNode } from 'react'

const tones = {
  danger: 'bg-rose-50 text-rose-700',
  warning: 'border border-amber-200 bg-amber-50 text-amber-800',
  info: 'bg-primary-50 text-primary-800'
}

export function Alert({ tone = 'danger', className, children }: { tone?: keyof typeof tones; className?: string; children: ReactNode }) {
  return <p className={clsx('my-3 rounded-xl px-3.5 py-2.5 text-sm', tones[tone], className)}>{children}</p>
}
