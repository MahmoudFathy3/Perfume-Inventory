import type { IpcContext } from '../../lib/context'
import type { HandleFn } from '../../lib/ipc'
import * as s from './workspaces.service'

export function register(handle: HandleFn, { session }: IpcContext): void {
  handle('workspaces:list', s.listWorkspaces)
  handle('workspaces:create', s.createWorkspace)
  handle('workspaces:update', s.updateWorkspace)
  handle('workspaces:activate', s.activateWorkspace)
  // قفل وفتح وحذف الشراكة محتاجين كلمة سر التطبيق
  handle('workspaces:close', ({ id, password }: { id: number; password: string }) => {
    session.confirmPassword(password)
    s.closeWorkspace({ id })
  })
  handle('workspaces:reopen', ({ id, password }: { id: number; password: string }) => {
    session.confirmPassword(password)
    s.reopenWorkspace({ id })
  })
  handle('workspaces:remove', ({ id, password }: { id: number; password: string }) => {
    session.confirmPassword(password)
    s.removeWorkspace({ id })
  })
}
