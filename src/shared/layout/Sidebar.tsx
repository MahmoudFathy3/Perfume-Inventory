import clsx from 'clsx'
import { ArrowLeftRight, Banknote, FolderTree, Handshake, HandCoins, Lock, LayoutDashboard, Package, PanelRightClose, PanelRightOpen, Receipt, Settings, ShoppingCart, Undo2, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { WorkspaceKind } from '@shared/types'
import { NavLink } from 'react-router-dom'
import { useAuth } from '@/features/auth'
import { useWorkspaces, WorkspaceSwitcher } from '@/features/workspaces'
import logo from '@/assets/logo.svg'
import { DevBadge } from '@/shared/components/ui'
import { useAppName } from '@/shared/hooks/useAppName'
import { useSidebarCollapsed } from './useSidebarCollapsed'

const ALL: WorkspaceKind[] = ['personal', 'partnership', 'warehouse']
const STORES: WorkspaceKind[] = ['personal', 'partnership']

/** kinds = أنواع المخازن اللي الرابط بيظهر فيها (المخزن الخارجي: الرئيسية والمخازن والإعدادات بس) */
const LINKS: { to: string; key: string; icon: LucideIcon; kinds: WorkspaceKind[] }[] = [
  { to: '/', key: 'dashboard', icon: LayoutDashboard, kinds: ALL },
  { to: '/items', key: 'items', icon: Package, kinds: STORES },
  { to: '/categories', key: 'categories', icon: FolderTree, kinds: STORES },
  { to: '/purchases', key: 'purchases', icon: ShoppingCart, kinds: STORES },
  { to: '/sales', key: 'sales', icon: Banknote, kinds: STORES },
  { to: '/customers', key: 'customers', icon: Users, kinds: STORES },
  { to: '/returns', key: 'returns', icon: Undo2, kinds: STORES },
  { to: '/transfers', key: 'transfers', icon: ArrowLeftRight, kinds: STORES },
  { to: '/expenses', key: 'expenses', icon: Receipt, kinds: STORES },
  { to: '/partners', key: 'partners', icon: HandCoins, kinds: ['partnership'] },
  { to: '/workspaces', key: 'workspaces', icon: Handshake, kinds: ALL },
  { to: '/settings', key: 'settings', icon: Settings, kinds: ALL }
]

const item = 'flex items-center gap-3 rounded-xl py-2.5 transition'

/** القايمة الجانبية: ثابتة في مكانها والمحتوى بس هو اللي بيتحرك مع السكرول. في الشاشات الصغيرة بتبقى أيقونات بس */
export function Sidebar() {
  const { t } = useTranslation()
  const { name: appName } = useAppName()
  const { active } = useWorkspaces()
  const { lock } = useAuth()
  const { collapsed, toggle } = useSidebarCollapsed()
  const ToggleIcon = collapsed ? PanelRightOpen : PanelRightClose
  const toggleLabel = t(collapsed ? 'nav.expand' : 'nav.collapse')

  return (
    <nav
      className={clsx(
        'sticky top-0 flex h-screen shrink-0 flex-col gap-1 self-start overflow-y-auto overflow-x-hidden bg-gradient-to-b from-slate-900 to-teal-900 py-5 transition-[width] duration-200',
        collapsed ? 'w-[72px] px-2' : 'w-[230px] px-3'
      )}
    >
      <div className={clsx('mb-2.5 flex items-center gap-3 border-b border-white/10 pb-[18px] pt-1.5 text-xl font-bold text-white', collapsed ? 'justify-center px-0' : 'px-3')}>
        <span className="relative shrink-0">
          <img src={logo} alt="" className="h-10 w-10 drop-shadow-md" />
          {collapsed && <DevBadge className="absolute -bottom-1.5 start-1/2 -translate-x-1/2 rtl:translate-x-1/2" />}
        </span>
        {!collapsed && <span className="min-w-0 truncate">{appName}</span>}
        {!collapsed && <DevBadge />}
      </div>
      <WorkspaceSwitcher compact={collapsed} />
      {LINKS.filter((link) => link.kinds.includes(active.kind)).map(({ to, key, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          title={collapsed ? t(`nav.${key}`) : undefined}
          className={({ isActive }) =>
            clsx(
              item,
              collapsed ? 'justify-center px-0' : 'px-3.5',
              isActive ? 'bg-teal-400/20 font-bold text-white shadow-[inset_3px_0_0_#2dd4bf] rtl:shadow-[inset_-3px_0_0_#2dd4bf]' : 'text-slate-300 hover:bg-white/10 hover:text-white'
            )
          }
        >
          <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span className={clsx(collapsed && 'sr-only')}>{t(`nav.${key}`)}</span>
        </NavLink>
      ))}
      <button
        type="button"
        onClick={toggle}
        title={collapsed ? toggleLabel : undefined}
        className={clsx(item, 'mt-auto text-slate-400 hover:bg-white/10 hover:text-white', collapsed ? 'justify-center px-0' : 'px-3.5')}
      >
        <ToggleIcon className="h-5 w-5 shrink-0 ltr:-scale-x-100" aria-hidden="true" />
        <span className={clsx(collapsed && 'sr-only')}>{toggleLabel}</span>
      </button>
      <button
        type="button"
        onClick={() => void lock()}
        title={collapsed ? t('auth.lockNow') : undefined}
        className={clsx(item, 'text-slate-300 hover:bg-white/10 hover:text-white', collapsed ? 'justify-center px-0' : 'px-3.5')}
      >
        <Lock className="h-5 w-5 shrink-0" aria-hidden="true" />
        <span className={clsx(collapsed && 'sr-only')}>{t('auth.lockNow')}</span>
      </button>
    </nav>
  )
}
