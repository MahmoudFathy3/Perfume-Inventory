import type { Workspace, WorkspaceInput } from '@shared/types'
import { getDb } from '../../database/connection'
import { AppError } from '../../lib/errors'
import { normalizeArabic } from '../../lib/normalizeArabic'
import { activeWorkspaceId, PERSONAL_WORKSPACE_ID, setActiveWorkspaceId } from '../../lib/workspace'
import * as repo from './workspaces.repository'

const SHARE = 50 // الشراكة بين اتنين بالنص

/** الاسم والشريكين بعد التنضيف. الاسم الفاضي = الواجهة بتعرض أسماء الشريكين. */
function clean(input: WorkspaceInput): { name: string; partners: string[] } {
  const partners = (input.partners ?? []).map((p) => String(p ?? '').trim())
  if (partners.length !== 2 || partners.some((p) => !p)) throw new AppError('PARTNERS_REQUIRED')
  if (normalizeArabic(partners[0]) === normalizeArabic(partners[1])) throw new AppError('DUPLICATE_PARTNERS')
  return { name: String(input.name ?? '').trim(), partners }
}

/** اللي بيظهر للمستخدم: الاسم المكتوب أو أسماء الشريكين. لازم يتميّز كل شراكة عن التانية. */
const labelOf = (name: string, partners: string[]) => normalizeArabic(name || [...partners].sort().join(' '))

function assertUniqueLabel(name: string, partners: string[], excludeId = 0): void {
  const taken = repo
    .findAll()
    .filter((w) => w.kind === 'partnership' && w.id !== excludeId)
    .some((w) => labelOf(w.name, repo.findPartners(w.id).map((p) => p.name)) === labelOf(name, partners))
  if (taken) throw new AppError('DUPLICATE_NAME')
}

function editable(id: number) {
  const ws = repo.findById(id)
  if (!ws) throw new AppError('WORKSPACE_NOT_FOUND')
  if (ws.kind === 'personal') throw new AppError('PERSONAL_WORKSPACE')
  return ws
}

export function listWorkspaces(): Workspace[] {
  const active = activeWorkspaceId()
  return repo.findAll().map((w) => ({ ...w, partners: repo.findPartners(w.id), active: w.id === active }))
}

export const createWorkspace = (input: WorkspaceInput): number =>
  getDb().transaction(() => {
    const { name, partners } = clean(input)
    assertUniqueLabel(name, partners)
    const id = repo.insert('partnership', name)
    for (const p of partners) repo.insertPartner(id, p, SHARE)
    return id
  })()

export const updateWorkspace = ({ id, ...input }: WorkspaceInput & { id: number }): void =>
  getDb().transaction(() => {
    editable(id)
    const { name, partners } = clean(input)
    assertUniqueLabel(name, partners, id)
    repo.rename(id, name)
    // بنغيّر الأسماء في مكانها علشان أرقام الشريكين (المرتبطة بالتحويلات والتسويات) تفضل ثابتة
    repo.findPartners(id).forEach((existing, i) => repo.renamePartner(existing.id, partners[i]))
  })()

/** التبديل للمساحة اللي هنشتغل عليها (لازم تكون مفتوحة) */
export function activateWorkspace({ id }: { id: number }): void {
  const ws = repo.findById(id)
  if (!ws) throw new AppError('WORKSPACE_NOT_FOUND')
  if (ws.closed_at) throw new AppError('WORKSPACE_CLOSED')
  setActiveWorkspaceId(id)
}

/** قفل الشراكة: بتختفي من التبديل وبياناتها بتفضل محفوظة. لو كانت هي النشطة بنرجع للمخزون الفعلي. */
export function closeWorkspace({ id }: { id: number }): void {
  editable(id)
  repo.setClosed(id, true)
  if (activeWorkspaceId() === id) setActiveWorkspaceId(PERSONAL_WORKSPACE_ID)
}

export function reopenWorkspace({ id }: { id: number }): void {
  editable(id)
  repo.setClosed(id, false)
}

/** حذف شراكة فاضية بس. اللي فيها بيانات بتتقفل. */
export function removeWorkspace({ id }: { id: number }): void {
  editable(id)
  if (repo.hasData(id)) throw new AppError('WORKSPACE_NOT_EMPTY')
  if (activeWorkspaceId() === id) setActiveWorkspaceId(PERSONAL_WORKSPACE_ID)
  repo.remove(id)
}
