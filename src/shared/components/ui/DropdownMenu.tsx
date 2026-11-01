import { ChevronDown } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Button } from './Button'

export interface MenuItem {
  key: string
  label: ReactNode
  icon?: LucideIcon
  onSelect: () => void
}

interface DropdownMenuProps {
  label: ReactNode
  icon?: LucideIcon
  items: MenuItem[]
}

/** زرار بقايمة اختيارات (التصدير، ونسخ القايمة...). بتتقفل لما تضغط بره. */
export function DropdownMenu({ label, icon, items }: DropdownMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  return (
    <div ref={ref} className="relative">
      <Button icon={icon} onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open}>
        {label}
        <ChevronDown className="h-4 w-4" aria-hidden="true" />
      </Button>
      {open && (
        <ul role="menu" className="absolute end-0 top-full z-20 mt-1.5 min-w-[190px] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-pop">
          {items.map(({ key, label: itemLabel, icon: ItemIcon, onSelect }) => (
            <li key={key} role="none">
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2.5 px-4 py-2 text-start hover:bg-primary-50"
                onClick={() => {
                  setOpen(false)
                  onSelect()
                }}
              >
                {ItemIcon && <ItemIcon className="h-4 w-4 text-slate-500" aria-hidden="true" />}
                {itemLabel}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
