import clsx from 'clsx'
import { Check, ChevronDown, Handshake, Settings2, Store } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@/shared/toast/ToastProvider'
import { useWorkspaces } from '../WorkspaceProvider'

/** تبديل المخزن (الفعلي أو إحدى الشراكات) من أعلى القايمة الجانبية */
export function WorkspaceSwitcher() {
  const { t } = useTranslation()
  const toast = useToast()
  const navigate = useNavigate()
  const { workspaces, active, label, activate } = useWorkspaces()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const icon = (kind: string) => (kind === 'personal' ? Store : Handshake)
  const ActiveIcon = icon(active.kind)

  async function choose(id: number) {
    setOpen(false)
    if (id === active.id) return
    try {
      await activate(id)
    } catch (e) {
      toast.fail(e)
    }
  }

  return (
    <div ref={ref} className="relative mb-3">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        title={t('workspaces.current')}
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2.5 rounded-xl bg-white/10 px-3 py-2.5 text-start text-white transition hover:bg-white/15"
      >
        <ActiveIcon className="h-5 w-5 shrink-0 text-teal-300" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] leading-tight text-slate-300">{t('workspaces.current')}</span>
          <span className="block truncate font-bold">{label(active)}</span>
        </span>
        <ChevronDown className={clsx('h-4 w-4 shrink-0 transition', open && 'rotate-180')} aria-hidden="true" />
      </button>

      {open && (
        <ul role="menu" className="absolute inset-x-0 top-full z-30 mt-1.5 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-slate-800 shadow-pop">
          {workspaces
            .filter((w) => !w.closed_at)
            .map((w) => {
              const Icon = icon(w.kind)
              return (
                <li key={w.id} role="none">
                  <button type="button" role="menuitemradio" aria-checked={w.active} onClick={() => choose(w.id)} className="flex w-full items-center gap-2.5 px-4 py-2 text-start hover:bg-primary-50">
                    <Icon className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                    <span className={clsx('flex-1 truncate', w.active && 'font-bold')}>{label(w)}</span>
                    {w.active && <Check className="h-4 w-4 shrink-0 text-primary-600" aria-hidden="true" />}
                  </button>
                </li>
              )
            })}
          <li role="none" className="mt-1 border-t border-slate-100 pt-1">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                navigate('/workspaces')
              }}
              className="flex w-full items-center gap-2.5 px-4 py-2 text-start text-slate-600 hover:bg-primary-50"
            >
              <Settings2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              {t('workspaces.manage')}
            </button>
          </li>
        </ul>
      )}
    </div>
  )
}
