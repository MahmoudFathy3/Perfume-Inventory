import type { ReactNode } from 'react'

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl bg-surface p-10 text-center text-slate-500 shadow-card">{children}</p>
}
