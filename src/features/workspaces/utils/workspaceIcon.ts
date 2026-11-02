import { Handshake, Store, Warehouse } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { WorkspaceKind } from '@shared/types'

const ICONS: Record<WorkspaceKind, LucideIcon> = { personal: Store, partnership: Handshake, warehouse: Warehouse }

/** أيقونة المخزن: الفعلي / شراكة / مخزن خارجي */
export const workspaceIcon = (kind: WorkspaceKind): LucideIcon => ICONS[kind]
