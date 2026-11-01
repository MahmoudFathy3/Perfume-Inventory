import clsx from 'clsx'
import { ArrowLeftRight, Banknote, FolderTree, Handshake, HandCoins, Lock, LayoutDashboard, Package, Settings, ShoppingCart, Undo2, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router-dom'
import { useAuth } from '@/features/auth'
import { useWorkspaces, WorkspaceSwitcher } from '@/features/workspaces'
import logo from '@/assets/logo.svg'

const LINKS: { to: string; key: string; icon: LucideIcon; partnershipOnly?: boolean }[] = [
  { to: '/', key: 'dashboard', icon: LayoutDashboard },
  { to: '/items', key: 'items', icon: Package },
  { to: '/categories', key: 'categories', icon: FolderTree },
  { to: '/purchases', key: 'purchases', icon: ShoppingCart },
  { to: '/sales', key: 'sales', icon: Banknote },
  { to: '/customers', key: 'customers', icon: Users },
  { to: '/returns', key: 'returns', icon: Undo2 },
  { to: '/transfers', key: 'transfers', icon: ArrowLeftRight },
  { to: '/partners', key: 'partners', icon: HandCoins, partnershipOnly: true },
  { to: '/workspaces', key: 'workspaces', icon: Handshake },
  { to: '/settings', key: 'settings', icon: Settings }
]

/** القايمة الجانبية: ثابتة في مكانها والمحتوى بس هو اللي بيتحرك مع السكرول */
export function Sidebar() {
  const { t } = useTranslation()
  const { active } = useWorkspaces()
  const { lock } = useAuth()
  return (
    <nav className="sticky top-0 flex h-screen w-[230px] shrink-0 flex-col gap-1 self-start overflow-y-auto bg-gradient-to-b from-slate-900 to-teal-900 px-3 py-5">
      <div className="mb-2.5 flex items-center gap-3 border-b border-white/10 px-3 pb-[18px] pt-1.5 text-xl font-bold text-white">
        <img src={logo} alt="" className="h-10 w-10 shrink-0 drop-shadow-md" />
        <span>{t('app.name')}</span>
      </div>
      <WorkspaceSwitcher />
      {LINKS.filter((link) => !link.partnershipOnly || active.kind === 'partnership').map(({ to, key, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            clsx(
              'flex items-center gap-3 rounded-xl px-3.5 py-2.5 transition',
              isActive ? 'bg-teal-400/20 font-bold text-white shadow-[inset_3px_0_0_#2dd4bf] rtl:shadow-[inset_-3px_0_0_#2dd4bf]' : 'text-slate-300 hover:bg-white/10 hover:text-white'
            )
          }
        >
          <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
          {t(`nav.${key}`)}
        </NavLink>
      ))}
      <button
        type="button"
        onClick={() => void lock()}
        className="mt-auto flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-slate-300 transition hover:bg-white/10 hover:text-white"
      >
        <Lock className="h-5 w-5 shrink-0" aria-hidden="true" />
        {t('auth.lockNow')}
      </button>
    </nav>
  )
}
