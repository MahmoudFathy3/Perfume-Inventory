import type { Item, PageParams, Transfer, TransferDetails, TransferInput, TransferMoney, TransferMoneyLine, TransferPaymentInput, TransfersFilter } from '@shared/types'
import { getDb } from '../../database/connection'
import { AppError, positiveAmount, round2, today } from '../../lib/errors'
import { activeWorkspaceId, PERSONAL_WORKSPACE_ID, withWorkspace } from '../../lib/workspace'
import * as itemsRepo from '../items/items.repository'
import * as partnersRepo from '../partners/partners.repository'
import * as paymentsRepo from '../payments/payments.repository'
import * as salesRepo from '../sales/sales.repository'
import { restoreLines, sellLines } from '../sales/sales.stock'
import { linkPartnerCustomers } from '../workspaces/workspaces.service'
import * as workspaces from '../workspaces/workspaces.repository'
import * as repo from './transfers.repository'
import { putIn, returnToSource, reverse, takeBackFromDestination, takeOut } from './transfers.stock'
import type { OutgoingLine } from './transfers.stock'
import { cleanTransfer } from './transfers.validation'
import type { CleanTransfer } from './transfers.validation'

export const pageTransfers = (p: TransfersFilter & PageParams) => repo.findPage(p, p)
export const summarizeTransfers = (filter: TransfersFilter = {}) => repo.summary(filter)

export function getTransfer({ id }: { id: number }): TransferDetails {
  const transfer = repo.findById(id)
  if (!transfer) throw new AppError('TRANSFER_NOT_FOUND')
  return { ...transfer, items: repo.findLines(id), payments: partnersRepo.findTransferPayments(id) }
}

/** منتجات مخزن تاني (علشان نختار منها وإحنا واقفين في مخزن مختلف) */
export function listSourceItems({ workspace_id }: { workspace_id: number }): Item[] {
  if (!workspaces.findById(workspace_id)) throw new AppError('WORKSPACE_NOT_FOUND')
  return withWorkspace(workspace_id, () => itemsRepo.findAll())
}

export const header = (c: CleanTransfer, out: OutgoingLine[]): repo.NewTransfer => ({
  from_workspace_id: c.from,
  to_workspace_id: c.to,
  kind: c.kind,
  partner_id: c.partnerId,
  transfer_date: c.date,
  total_cost: round2(out.reduce((sum, l) => sum + l.quantity * l.unit_cost, 0)),
  total_price: round2(out.reduce((sum, l) => sum + l.quantity * l.unit_price, 0)),
  notes: c.notes,
  recipient: c.recipient
})

export function insertLines(id: number, out: OutgoingLine[], toItemIds: number[]): void {
  out.forEach((l, i) =>
    repo.insertLine({
      transfer_id: id,
      from_item_id: l.from_item_id,
      to_item_id: toItemIds[i],
      condition: l.condition,
      quantity: l.quantity,
      unit_cost: l.unit_cost,
      unit_price: l.unit_price
    })
  )
}

/**
 * التحويل للشريك التاني (اشترى القطع من صاحب المخزون): القطع بتخرج من المخزون الفعلي بفاتورة بيع
 * على عميل الشريك بسعر القطعة (الربح لصاحب المخزون والدين على الشريك)، وبتدخل الشراكة رأس مال له بنفس السعر.
 */
function sellToPartner(c: CleanTransfer, out: OutgoingLine[]): number {
  linkPartnerCustomers(c.to)
  const partner = workspaces.findPartners(c.to).find((p) => p.id === c.partnerId)
  if (!partner?.customer_id) throw new AppError('CUSTOMER_NOT_FOUND')
  const customerId = partner.customer_id
  return withWorkspace(PERSONAL_WORKSPACE_ID, () => {
    const saleId = salesRepo.insertHeader({
      customer_id: customerId,
      partner_id: null,
      sale_date: c.date,
      price_type: 'retail',
      shipping_payer: 'customer',
      shipping_cost: 0,
      total: 0,
      notes: c.notes
    })
    const lines = out.map((o) => ({ item_id: o.from_item_id, condition: o.condition, quantity: o.quantity, selling_price: o.unit_price, source: null, transfer_price: null }))
    const subtotal = sellLines(saleId, { customerId, partnerId: null, date: c.date, priceType: 'retail', payer: 'customer', shipping: 0, notes: c.notes, lines }, false)
    salesRepo.setTotal(saleId, round2(subtotal))
    return saleId
  })
}

/** إلغاء فاتورة الشريك (تعديل التحويل أو حذفه): القطع بترجع للمخزون الفعلي. مينفعش لو دفع منها أو عليها مرتجع. */
function undoPartnerSale(saleId: number): void {
  withWorkspace(PERSONAL_WORKSPACE_ID, () => {
    if (paymentsRepo.sumForSale(saleId) > 0) throw new AppError('PARTNER_INVOICE_PAID')
    if (salesRepo.returnsCount(saleId) > 0) throw new AppError('HAS_RETURNS')
    restoreLines(saleId)
  })
}

const removePartnerSale = (saleId: number) => withWorkspace(PERSONAL_WORKSPACE_ID, () => salesRepo.remove(saleId))

/** بيعمل التحويل على المخزن (الخصم من المصدر والإضافة للوجهة) */
function apply(c: CleanTransfer): { out: OutgoingLine[]; toItemIds: number[]; partnerSaleId: number | null } {
  if (c.recipient === 'partner') {
    // قيمة رأس مال الشريك = السعر اللي دفعه في القطعة
    const out = takeOut(c, false).map((o) => ({ ...o, unit_cost: o.unit_price }))
    const partnerSaleId = sellToPartner(c, out)
    return { out, toItemIds: putIn(c.to, out), partnerSaleId }
  }
  const out = takeOut(c)
  return { out, toItemIds: putIn(c.to, out), partnerSaleId: null }
}

/** تحويل قطع بين المخزون الفعلي وشراكة (في أي اتجاه) */
export const createTransfer = (input: TransferInput): number =>
  getDb().transaction(() => {
    const c = cleanTransfer(input)
    const { out, toItemIds, partnerSaleId } = apply(c)
    const id = repo.insertHeader({ ...header(c, out), partner_sale_id: partnerSaleId })
    insertLines(id, out, toItemIds)
    return id
  })()

/**
 * تعديل التحويل (أي حاجة فيه: الاتجاه، النوع، الشريك، المنتجات، الكميات، الأسعار).
 * العادي: بنعكس القديم كله وبعدين نعمل الجديد (المتوسطات بترجع بالظبط).
 * لو الوجهة باعت جزء من القطع (العكس الكامل مش ممكن): القديم بيرجع للمصدر، والجديد بيتعمل، وفي الآخر القديم بيخرج من الوجهة.
 * كده تعديل سعر أو ملاحظة بيشتغل حتى لو اتباع جزء، والرفض (OUT_OF_STOCK) بس لو الكمية الجديدة أقل من اللي اتباع.
 */
export const updateTransfer = ({ id, ...input }: TransferInput & { id: number }): void =>
  getDb().transaction(() => {
    const old = repo.findById(id)
    if (!old) throw new AppError('TRANSFER_NOT_FOUND')
    if (old.sale_id) throw new AppError('TRANSFER_FROM_SALE')
    for (const wsId of [old.from_workspace_id, old.to_workspace_id]) {
      if (workspaces.findById(wsId)?.closed_at) throw new AppError('WORKSPACE_CLOSED')
    }
    const oldLines = repo.findLineRows(id)
    const c = cleanTransfer(input)
    // التحويل اللي عليه دفعات: الدفعات مربوطة بالشريك والاتجاه، فدول مينفعش يتغيّروا
    const hasPayments = old.paid > 0
    const sameDeal = c.kind === 'sale' && c.partnerId === old.partner_id && c.from === old.from_workspace_id && c.to === old.to_workspace_id
    if (hasPayments && !sameDeal) throw new AppError('TRANSFER_HAS_PAYMENTS')

    // التحويل للشريك (قبل أو بعد): بنلغي القديم كله وبنعمل الجديد (لو الشراكة باعت القطع بيترفض)
    if (old.partner_sale_id || c.recipient === 'partner') {
      if (old.partner_sale_id) {
        takeBackFromDestination(old.to_workspace_id, oldLines)
        undoPartnerSale(old.partner_sale_id)
      } else {
        reverse(old.from_workspace_id, old.to_workspace_id, oldLines)
      }
      const r = apply(c)
      repo.deleteLines(id)
      repo.updateHeader(id, { ...header(c, r.out), partner_sale_id: r.partnerSaleId })
      insertLines(id, r.out, r.toItemIds)
      if (old.partner_sale_id) removePartnerSale(old.partner_sale_id)
      return
    }

    let reversed = true
    try {
      getDb().transaction(() => reverse(old.from_workspace_id, old.to_workspace_id, oldLines))() // savepoint: لو فشل مبيسيبش أثر
    } catch (e) {
      if (!(e instanceof AppError) || e.code !== 'OUT_OF_STOCK') throw e
      reversed = false
      returnToSource(old.from_workspace_id, oldLines)
    }
    const out = takeOut(c)
    const toItemIds = putIn(c.to, out)
    if (!reversed) takeBackFromDestination(old.to_workspace_id, oldLines)

    const h = header(c, out)
    if (h.total_price < old.paid - 0.005) throw new AppError('TOTAL_BELOW_PAID')
    repo.deleteLines(id)
    repo.updateHeader(id, { ...h, partner_sale_id: null })
    insertLines(id, out, toItemIds)
  })()

/** حذف التحويل = عكسه. لو الوجهة باعت القطع أو استهلكتها بيترفض (OUT_OF_STOCK). */
export const removeTransfer = ({ id }: { id: number }): void =>
  getDb().transaction(() => {
    const transfer = repo.findById(id)
    if (!transfer) throw new AppError('TRANSFER_NOT_FOUND')
    if (transfer.sale_id) throw new AppError('TRANSFER_FROM_SALE')
    if (transfer.partner_sale_id) {
      // التحويل للشريك: القطع بتخرج من الشراكة، وفاتورته في المخزون الفعلي بتتلغي والقطع بترجع
      takeBackFromDestination(transfer.to_workspace_id, repo.findLineRows(id))
      undoPartnerSale(transfer.partner_sale_id)
      repo.remove(id)
      removePartnerSale(transfer.partner_sale_id)
      return
    }
    reverse(transfer.from_workspace_id, transfer.to_workspace_id, repo.findLineRows(id))
    partnersRepo.removeTransferPayments(id) // دفعاته بتتحذف معاه (الواجهة بتنبّه قبل الحذف)
    repo.remove(id)
  })()

/**
 * دفعة على تحويل بيع بسعر. بتتسجل تسوية للشريك في الشراكة (فحسابات الشركاء بتتظبط لوحدها):
 * بيع للشراكة = الشراكة دفعت للشريك البائع، بيع من الشراكة = الشريك المشتري دفع للشراكة.
 */
export const payTransfer = (input: TransferPaymentInput): number =>
  getDb().transaction(() => {
    const transfer = repo.findById(Number(input.transfer_id))
    if (!transfer) throw new AppError('TRANSFER_NOT_FOUND')
    if (transfer.kind !== 'sale' || !transfer.partner_id) throw new AppError('NOT_A_SALE_TRANSFER')
    const partnership = transfer.from_workspace_id === PERSONAL_WORKSPACE_ID ? transfer.to_workspace_id : transfer.from_workspace_id
    if (workspaces.findById(partnership)?.closed_at) throw new AppError('WORKSPACE_CLOSED')

    const amount = positiveAmount(input.amount)
    if (amount > round2(transfer.total_price - transfer.paid) + 0.005) throw new AppError('PAYMENT_EXCEEDS_REMAINING')
    const intoPartnership = transfer.to_workspace_id === partnership
    return partnersRepo.insertPayment({
      workspace_id: partnership,
      partner_id: transfer.partner_id,
      amount: intoPartnership ? amount : -amount,
      payment_date: input.payment_date || today(),
      notes: input.notes?.trim() || null,
      transfer_id: transfer.id
    })
  })()

/** الشراكة اللي دفعات التحويل متسجلة فيها (لازم تكون مفتوحة علشان نعدّل فيها) */
function paymentsPartnership(transferId: number): number {
  const transfer = repo.findById(transferId)
  if (!transfer) throw new AppError('TRANSFER_NOT_FOUND')
  const partnership = transfer.from_workspace_id === PERSONAL_WORKSPACE_ID ? transfer.to_workspace_id : transfer.from_workspace_id
  if (workspaces.findById(partnership)?.closed_at) throw new AppError('WORKSPACE_CLOSED')
  return partnership
}

/** حذف دفعة واحدة على تحويل (اتسجلت بالغلط، أو الدفع اترجع): التحويل بيرجع عليه المبلغ */
export const removeTransferPayment = ({ transfer_id, id }: { transfer_id: number; id: number }): void => {
  const partnership = paymentsPartnership(transfer_id)
  if (!partnersRepo.findTransferPayments(transfer_id).some((p) => p.id === id)) throw new AppError('PAYMENT_NOT_FOUND')
  partnersRepo.removePayment(id, partnership)
}

/** التحويل يرجع "لسه متدفعش": كل دفعاته بتتحذف */
export const unpayTransfer = ({ transfer_id }: { transfer_id: number }): void => {
  paymentsPartnership(transfer_id)
  partnersRepo.removeTransferPayments(transfer_id)
}

function addTo(line: TransferMoneyLine, t: Transfer): void {
  line.total = round2(line.total + t.total_price)
  line.paid = round2(line.paid + t.paid)
  line.remaining = round2(line.total - line.paid)
  if (repo.isUnpaid(t)) line.unpaid_count++
}

/** الفلوس اللي لينا واللي علينا من تحويلات البيع بسعر (المخزن النشط)، ولكل مخزن تاني لوحده */
export function transferMoney(): TransferMoney {
  const ws = activeWorkspaceId()
  const result: TransferMoney = { receivable: repo.emptyMoneyLine(), payable: repo.emptyMoneyLine(), stores: [], unpaid: [] }
  const stores = new Map<number, TransferMoney['stores'][number]>()
  const sales = repo.findSales(ws)
  for (const t of sales) {
    const sold = t.from_workspace_id === ws
    const other = sold ? t.to_workspace_id : t.from_workspace_id
    if (!stores.has(other)) stores.set(other, { workspace_id: other, receivable: repo.emptyMoneyLine(), payable: repo.emptyMoneyLine() })
    const store = stores.get(other)!
    addTo(sold ? result.receivable : result.payable, t)
    addTo(sold ? store.receivable : store.payable, t)
  }
  result.stores = [...stores.values()]
  result.unpaid = sales.filter(repo.isUnpaid).slice(0, 8)
  return result
}
