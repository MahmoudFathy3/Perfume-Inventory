import type { Workspace, WorkspaceKind, WorkspacePartner } from '@shared/types'
import { execute, queryAll, queryOne } from '../../database/connection'

type WorkspaceRow = Omit<Workspace, 'partners' | 'active'>

export const findAll = (): WorkspaceRow[] =>
  queryAll<WorkspaceRow>("SELECT id, kind, name, closed_at FROM workspaces ORDER BY kind = 'personal' DESC, id")

export const findById = (id: number) => queryOne<WorkspaceRow>('SELECT id, kind, name, closed_at FROM workspaces WHERE id = ?', [id])

export const findPartners = (workspaceId: number) =>
  queryAll<WorkspacePartner>('SELECT id, name, share_percent FROM workspace_partners WHERE workspace_id = ? ORDER BY id', [workspaceId])

export const insert = (kind: WorkspaceKind, name: string): number => execute('INSERT INTO workspaces(kind, name) VALUES (?, ?)', [kind, name])
export const rename = (id: number, name: string) => void execute('UPDATE workspaces SET name = ? WHERE id = ?', [name, id])
export const setClosed = (id: number, closed: boolean) =>
  void execute(`UPDATE workspaces SET closed_at = ${closed ? "datetime('now','localtime')" : 'NULL'} WHERE id = ?`, [id])
export const remove = (id: number) => void execute('DELETE FROM workspaces WHERE id = ?', [id])

export const insertPartner = (workspaceId: number, name: string, share: number) =>
  void execute('INSERT INTO workspace_partners(workspace_id, name, share_percent) VALUES (?, ?, ?)', [workspaceId, name, share])
export const renamePartner = (id: number, name: string) => void execute('UPDATE workspace_partners SET name = ? WHERE id = ?', [name, id])

/** هل في المساحة أي بيانات (أصناف / منتجات / عملاء / فواتير / تحويلات)؟ المساحة اللي فيها بيانات مينفعش تتحذف، بتتقفل بس. */
export const hasData = (id: number): boolean =>
  !!queryOne(
    `SELECT 1 FROM categories WHERE workspace_id = @id UNION ALL SELECT 1 FROM items WHERE workspace_id = @id
     UNION ALL SELECT 1 FROM customers WHERE workspace_id = @id UNION ALL SELECT 1 FROM purchases WHERE workspace_id = @id
     UNION ALL SELECT 1 FROM sales WHERE workspace_id = @id UNION ALL SELECT 1 FROM returns WHERE workspace_id = @id
     UNION ALL SELECT 1 FROM transfers WHERE from_workspace_id = @id OR to_workspace_id = @id
     UNION ALL SELECT 1 FROM partner_payments WHERE workspace_id = @id LIMIT 1`,
    { id }
  )
