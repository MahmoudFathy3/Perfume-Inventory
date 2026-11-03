import type { Condition, TransferInput, TransferKind, TransferRecipient } from '@shared/types'
import { AppError, optionalMoney, parseCondition, qty, today } from '../../lib/errors'
import { PERSONAL_WORKSPACE_ID } from '../../lib/workspace'
import * as workspaces from '../workspaces/workspaces.repository'

export interface CleanTransferLine {
  item_id: number
  condition: Condition
  quantity: number
  /** null = السعر الافتراضي (القطاعي في البيع من المخزون الفعلي للشراكة، وإلا تكلفة المصدر) */
  unit_price: number | null
}

export interface CleanTransfer {
  from: number
  to: number
  kind: TransferKind
  partnerId: number | null
  date: string
  notes: string | null
  lines: CleanTransferLine[]
  /** من المخزون الفعلي للشراكة: لمين (null = من غير تحديد) */
  recipient: TransferRecipient | null
}

const KINDS: TransferKind[] = ['capital', 'sale', 'half']

/** مخزن موجود ومفتوح */
function openWorkspace(id: number) {
  const ws = workspaces.findById(Number(id))
  if (!ws) throw new AppError('WORKSPACE_NOT_FOUND')
  if (ws.closed_at) throw new AppError('WORKSPACE_CLOSED')
  return ws
}

/**
 * فحص مدخلات التحويل: واحد من الطرفين لازم يكون المخزون الفعلي والتاني شراكة،
 * وصاحب رأس المال / البيع لازم يكون شريك في الشراكة دي.
 */
export function cleanTransfer(input: TransferInput): CleanTransfer {
  const from = openWorkspace(input.from_workspace_id)
  const to = openWorkspace(input.to_workspace_id)
  const involvesPersonal = from.id === PERSONAL_WORKSPACE_ID || to.id === PERSONAL_WORKSPACE_ID
  if (from.id === to.id || !involvesPersonal) throw new AppError('INVALID_TRANSFER')
  if ((from.id === PERSONAL_WORKSPACE_ID ? to : from).kind !== 'partnership') throw new AppError('INVALID_TRANSFER')

  if (input.recipient) return cleanForRecipient(input, from.id, to.id)
  if (!KINDS.includes(input.kind)) throw new AppError('INVALID_TYPE')

  let partnerId: number | null = null
  if (input.kind !== 'half') {
    const partnership = from.id === PERSONAL_WORKSPACE_ID ? to : from
    if (!input.partner_id) throw new AppError('PARTNER_REQUIRED')
    if (!workspaces.findPartners(partnership.id).some((p) => p.id === Number(input.partner_id))) throw new AppError('PARTNER_NOT_FOUND')
    partnerId = Number(input.partner_id)
  }

  if (!Array.isArray(input.items) || input.items.length === 0) throw new AppError('NO_LINES')
  const lines = input.items.map((l) => ({
    item_id: Number(l.item_id),
    condition: parseCondition(l.condition),
    quantity: qty(l.quantity),
    unit_price: input.kind === 'sale' ? optionalMoney(l.unit_price) : null
  }))

  return { from: from.id, to: to.id, kind: input.kind, partnerId, date: input.transfer_date || today(), notes: input.notes?.trim() || null, lines, recipient: null }
}

const RECIPIENTS: TransferRecipient[] = ['owner', 'partner', 'partnership']

/**
 * التحويل من المخزون الفعلي للشراكة "لمين" (لازم صاحب المخزون يكون شريك فيها):
 * - owner: رأس مال أو بيع بسعر، والشريك = صاحب المخزون.
 * - partner: الشريك التاني اشترى القطع (رأس مال له بسعر القطعة + فاتورة عليه في المخزون الفعلي).
 * - partnership: بيع للشراكة بالتكلفة لصاحب المخزون (القطع بالنص بين الشركاء).
 */
function cleanForRecipient(input: TransferInput, from: number, to: number): CleanTransfer {
  const recipient = input.recipient as TransferRecipient
  if (!RECIPIENTS.includes(recipient)) throw new AppError('INVALID_TYPE')
  if (from !== PERSONAL_WORKSPACE_ID) throw new AppError('INVALID_TRANSFER')
  const partners = workspaces.findPartners(to)
  const owner = partners.find((p) => p.is_owner)
  if (!owner) throw new AppError('OWNER_REQUIRED')

  let kind: TransferKind = 'sale'
  let partnerId = owner.id
  if (recipient === 'owner') {
    if (input.kind !== 'capital' && input.kind !== 'sale') throw new AppError('INVALID_TYPE')
    kind = input.kind
  } else if (recipient === 'partner') {
    const partner = partners.find((p) => p.id === Number(input.partner_id) && !p.is_owner)
    if (!partner) throw new AppError('PARTNER_NOT_FOUND')
    kind = 'capital'
    partnerId = partner.id
  }

  if (!Array.isArray(input.items) || input.items.length === 0) throw new AppError('NO_LINES')
  // السعر: بيع بسعر من صاحب المخزون أو شراء الشريك. "للشراكة" دايمًا بالتكلفة.
  const priced = (recipient === 'owner' && kind === 'sale') || recipient === 'partner'
  const lines = input.items.map((l) => ({
    item_id: Number(l.item_id),
    condition: parseCondition(l.condition),
    quantity: qty(l.quantity),
    unit_price: priced ? optionalMoney(l.unit_price) : null
  }))
  return { from, to, kind, partnerId, date: input.transfer_date || today(), notes: input.notes?.trim() || null, lines, recipient }
}
