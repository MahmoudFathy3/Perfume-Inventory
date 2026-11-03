import type { Workspace, WorkspaceInput } from '@shared/types'
import { getDb } from '../../database/connection'
import { AppError } from '../../lib/errors'
import { normalizeArabic } from '../../lib/normalizeArabic'
import { activeWorkspaceId, PERSONAL_WORKSPACE_ID, setActiveWorkspaceId, withWorkspace } from '../../lib/workspace'
import * as customers from '../customers/customers.repository'
import * as settings from '../settings/settings.service'
import * as repo from './workspaces.repository'

const SHARE = 50 // الشراكة بين اتنين بالنص

/**
 * بيربط كل شريك (غير صاحب المخزون) بعميل في المخزون الفعلي: عميل موجود بنفس الاسم أو عميل جديد.
 * مبيعملش حاجة لو صاحب المخزون لسه متحددش (مش عارفين مين "التاني").
 */
export function linkPartnerCustomers(workspaceId?: number): void {
  if (!getOwner()) return
  const ids = workspaceId ? [workspaceId] : repo.findAll().filter((w) => w.kind === 'partnership').map((w) => w.id)
  withWorkspace(PERSONAL_WORKSPACE_ID, () => {
    for (const id of ids) {
      for (const p of repo.findPartners(id)) {
        if (p.is_owner || (p.customer_id && customers.findById(p.customer_id))) continue
        repo.setPartnerCustomer(p.id, customers.findByName(p.name)?.id ?? customers.insert(p.name, null))
      }
    }
  })
}

/** الشريك اتغيّر اسمه: عميله بياخد الاسم الجديد لو كان بنفس الاسم القديم ومفيش عميل تاني بالاسم الجديد */
function renamePartnerCustomer(customerId: number | null, oldName: string, newName: string): void {
  if (!customerId) return
  withWorkspace(PERSONAL_WORKSPACE_ID, () => {
    const customer = customers.findById(customerId)
    if (!customer || normalizeArabic(customer.name) !== normalizeArabic(oldName) || customers.findByName(newName, customerId)) return
    customers.update(customerId, newName, customer.phone)
  })
}

/** صاحب المخزون الفعلي (null = لسه متحددش) */
export const getOwner = (): string | null => settings.get({ key: 'owner_name' })?.trim() || null

const isOwner = (name: string, owner = getOwner()) => !!owner && normalizeArabic(name) === normalizeArabic(owner)

/**
 * تحديد / تغيير صاحب المخزون الفعلي. لو اتغيّر الاسم، بيتغيّر في كل الشراكات اللي هو شريك فيها
 * (نفس رقم الشريك، فالتحويلات والتسويات بتفضل مربوطة).
 */
export const setOwner = ({ name }: { name: string }): void =>
  getDb().transaction(() => {
    const next = String(name ?? '').trim()
    if (!next) throw new AppError('NAME_REQUIRED')
    const old = getOwner()
    if (old && normalizeArabic(old) !== normalizeArabic(next)) {
      for (const w of repo.findAll()) {
        const partners = repo.findPartners(w.id)
        const mine = partners.find((p) => isOwner(p.name, old))
        if (!mine) continue
        if (partners.some((p) => p.id !== mine.id && normalizeArabic(p.name) === normalizeArabic(next))) throw new AppError('DUPLICATE_PARTNERS')
        repo.renamePartner(mine.id, next)
      }
    } else if (old) {
      // نفس الاسم بكتابة مختلفة (همزة مثلًا): بنوحّد الكتابة في الشراكات
      for (const w of repo.findAll()) repo.findPartners(w.id).filter((p) => isOwner(p.name, old)).forEach((p) => repo.renamePartner(p.id, next))
    }
    settings.set({ key: 'owner_name', value: next })
    linkPartnerCustomers()
  })()

/**
 * الاسم والشريكين بعد التنضيف. الاسم الفاضي = الواجهة بتعرض أسماء الشريكين.
 * requireOwner: صاحب المخزون لازم يفضل شريك (الشراكات الجديدة، واللي هو أصلًا فيها).
 */
function clean(input: WorkspaceInput, requireOwner = true): { name: string; partners: string[] } {
  const partners = (input.partners ?? []).map((p) => String(p ?? '').trim())
  if (partners.length !== 2 || partners.some((p) => !p)) throw new AppError('PARTNERS_REQUIRED')
  if (normalizeArabic(partners[0]) === normalizeArabic(partners[1])) throw new AppError('DUPLICATE_PARTNERS')
  // صاحب المخزون الفعلي لازم يكون واحد من الشريكين (لو متحدد)
  const owner = getOwner()
  if (requireOwner && owner && !partners.some((p) => isOwner(p, owner))) throw new AppError('OWNER_NOT_PARTNER')
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

/** اسم المخزن الخارجي: مطلوب ومينفعش يتكرر بين المخازن الخارجية */
function warehouseName(input: WorkspaceInput, excludeId = 0): string {
  const name = String(input.name ?? '').trim()
  if (!name) throw new AppError('NAME_REQUIRED')
  const taken = repo.findAll().some((w) => w.kind === 'warehouse' && w.id !== excludeId && normalizeArabic(w.name) === normalizeArabic(name))
  if (taken) throw new AppError('DUPLICATE_NAME')
  return name
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
    if (input.kind === 'warehouse') return repo.insert('warehouse', warehouseName(input))
    const { name, partners } = clean(input)
    assertUniqueLabel(name, partners)
    const id = repo.insert('partnership', name)
    for (const p of partners) repo.insertPartner(id, p, SHARE)
    linkPartnerCustomers(id)
    return id
  })()

export const updateWorkspace = ({ id, ...input }: WorkspaceInput & { id: number }): void =>
  getDb().transaction(() => {
    if (editable(id).kind === 'warehouse') return repo.rename(id, warehouseName(input, id))
    // شراكة قديمة صاحب المخزون مش فيها بتتعدّل عادي
    const { name, partners } = clean(input, repo.findPartners(id).some((p) => p.is_owner))
    assertUniqueLabel(name, partners, id)
    repo.rename(id, name)
    // بنغيّر الأسماء في مكانها علشان أرقام الشريكين (المرتبطة بالتحويلات والتسويات) تفضل ثابتة
    repo.findPartners(id).forEach((existing, i) => {
      repo.renamePartner(existing.id, partners[i])
      renamePartnerCustomer(existing.customer_id, existing.name, partners[i])
    })
    linkPartnerCustomers(id)
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
