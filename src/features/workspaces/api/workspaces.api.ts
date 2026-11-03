import type { Workspace, WorkspaceInput } from '@shared/types'
import { invoke } from '@/shared/api/ipc'

export const workspacesApi = {
  list: () => invoke<Workspace[]>('workspaces:list'),
  create: (p: WorkspaceInput) => invoke<number>('workspaces:create', p),
  update: (p: WorkspaceInput & { id: number }) => invoke<void>('workspaces:update', p),
  activate: (p: { id: number }) => invoke<void>('workspaces:activate', p),
  /** صاحب المخزون الفعلي (null = لسه متحددش) */
  owner: () => invoke<string | null>('workspaces:owner'),
  /** تحديد / تغيير صاحب المخزون (بيتغيّر في كل شراكاته) */
  setOwner: (p: { name: string }) => invoke<void>('workspaces:setOwner', p),
  close: (p: { id: number; password: string }) => invoke<void>('workspaces:close', p),
  reopen: (p: { id: number; password: string }) => invoke<void>('workspaces:reopen', p),
  remove: (p: { id: number; password: string }) => invoke<void>('workspaces:remove', p)
}
