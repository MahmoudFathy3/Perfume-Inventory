import clsx from 'clsx'
import type { HTMLAttributes } from 'react'

export function Card({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={clsx('rounded-2xl bg-surface p-5 shadow-card', className)} {...props} />
}
