import type { Workspace, WorkspaceInput } from '@shared/types'
import { invoke } from '@/shared/api/ipc'

export const workspacesApi = {
  list: () => invoke<Workspace[]>('workspaces:list'),
  create: (p: WorkspaceInput) => invoke<number>('workspaces:create', p),
  update: (p: WorkspaceInput & { id: number }) => invoke<void>('workspaces:update', p),
  activate: (p: { id: number }) => invoke<void>('workspaces:activate', p),
  close: (p: { id: number; password: string }) => invoke<void>('workspaces:close', p),
  reopen: (p: { id: number; password: string }) => invoke<void>('workspaces:reopen', p),
  remove: (p: { id: number; password: string }) => invoke<void>('workspaces:remove', p)
}
