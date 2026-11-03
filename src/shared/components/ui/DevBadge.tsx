import clsx from 'clsx'
import { ENV } from '@/config/env'

/** علامة "DEV": بتظهر بس في وضع التطوير علشان متتلخبطش بين داتا الديف والبرودكشن */
export function DevBadge({ className }: { className?: string }) {
  if (!ENV.isDev) return null
  return (
    <span
      title="Development database"
      className={clsx('inline-block shrink-0 rounded-md bg-amber-400 px-1.5 py-0.5 text-[11px] font-bold leading-none tracking-wider text-amber-950', className)}
    >
      DEV
    </span>
  )
}
