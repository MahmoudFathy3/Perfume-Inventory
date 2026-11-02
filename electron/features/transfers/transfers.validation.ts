import type { Condition, TransferInput, TransferKind } from '@shared/types'
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

  return { from: from.id, to: to.id, kind: input.kind, partnerId, date: input.transfer_date || today(), notes: input.notes?.trim() || null, lines }
}
