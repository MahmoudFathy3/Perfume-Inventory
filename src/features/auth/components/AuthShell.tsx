import type { ReactNode } from 'react'
import logo from '@/assets/logo.svg'
import { DevBadge } from '@/shared/components/ui'
import { useAppName } from '@/shared/hooks/useAppName'

/** إطار شاشات كلمة السر: شعار + عنوان + محتوى في كارت في النص */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const { name: appName } = useAppName()
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 to-teal-900 p-6">
      <div className="w-[440px] max-w-full rounded-2xl bg-white px-7 py-8 shadow-pop">
        <div className="mb-5 flex flex-col items-center gap-2 text-center">
          <img src={logo} alt="" className="h-16 w-16" />
          <strong className="flex items-center gap-2 text-lg text-slate-500">{appName} <DevBadge /></strong>
          <h1 className="text-xl">{title}</h1>
          {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  )
}
