import type { Condition, PriceType } from '@shared/types'
import { removeFromAverage } from '../../lib/cost'
import { AppError } from '../../lib/errors'
import { PERSONAL_WORKSPACE_ID, withWorkspace } from '../../lib/workspace'
import * as itemStock from '../items/stock.repository'
import * as partnersRepo from '../partners/partners.repository'
import * as salesRepo from '../sales/sales.repository'
import * as workspaces from '../workspaces/workspaces.repository'
import * as repo from './transfers.repository'
import { header, insertLines } from './transfers.service'
import { putIn, returnToSource, reverse, takeOut } from './transfers.stock'
import { cleanTransfer } from './transfers.validation'

/**
 * التحويلات التلقائية لفاتورة بيع فيها منتجات من مخزن تاني (المخزون الفعلي ↔ شراكة):
 * السطور دي بتتحوّل "بيع بسعر" لمخزن الفاتورة قبل البيع، والشريك في التحويل = صاحب المخزون الفعلي.
 * بسعر التحويل = سعر البيع: ربح القطعة كله للمخزن اللي هي منه، ومخزن الفاتورة ربحه فيها صفر.
 */

const EPS = 0.005

/** سطر جاي من مخزن تاني */
export interface ForeignLine {
  source: number
  /** المنتج في المخزن التاني */
  item_id: number
  condition: Condition
  quantity: number
  unit_price: number
}

/** الشراكة في التحويل (الطرف اللي مش المخزون الفعلي) */
const partnershipOf = (a: number, b: number) => (a === PERSONAL_WORKSPACE_ID ? b : a)

/** السعر الافتراضي للسطر من المخزن التاني (قطاعي أو جملة حسب الفاتورة) */
export function sourcePrice(source: number, itemId: number, condition: Condition, priceType: PriceType): number {
  const stock = withWorkspace(source, () => itemStock.getStock(itemId, condition))
  if (!stock) return 0
  return priceType === 'wholesale' && stock.wholesale_price > 0 ? stock.wholesale_price : stock.selling_price
}

/**
 * بيحوّل السطور لمخزن الفاتورة (تحويل لكل مخزن مصدر، مربوط بالفاتورة)،
 * وبيرجّع لكل سطر رقم المنتج في مخزن الفاتورة (بيتعمل لو مش موجود).
 */
export function transferForSale(saleId: number, saleWorkspace: number, date: string, lines: ForeignLine[]): number[] {
  const result: number[] = new Array(lines.length)
  for (const source of new Set(lines.map((l) => l.source))) {
    const indexes = lines.map((_, i) => i).filter((i) => lines[i].source === source)
    const owner = workspaces.findPartners(partnershipOf(source, saleWorkspace)).find((p) => p.is_owner)
    if (!owner) throw new AppError('OWNER_REQUIRED')

    const c = cleanTransfer({
      from_workspace_id: source,
      to_workspace_id: saleWorkspace,
      kind: 'sale',
      partner_id: owner.id,
      transfer_date: date,
      items: indexes.map((i) => ({ item_id: lines[i].item_id, condition: lines[i].condition, quantity: lines[i].quantity, unit_price: lines[i].unit_price }))
    })
    const out = takeOut(c)
    const id = repo.insertHeader({ ...header(c, out), sale_id: saleId })
    const toItemIds = putIn(c.to, out)
    insertLines(id, out, toItemIds)
    indexes.forEach((i, k) => (result[i] = toItemIds[k]))
  }
  return result
}

/** إلغاء تحويلات الفاتورة (تعديلها أو حذفها): القطع بترجع لمصدرها، والدفعات بتتحذف */
export function removeSaleTransfers(saleId: number): void {
  for (const t of repo.findBySale(saleId)) {
    reverse(t.from_workspace_id, t.to_workspace_id, repo.findLineRows(t.id))
    partnersRepo.removeTransferPayments(t.id)
    repo.remove(t.id)
  }
}

/**
 * دفع تحويلات الفاتورة ماشي مع الفاتورة: لما الفاتورة تتدفع كلها (بعد المرتجع) التحويلات بتتعلّم مدفوعة
 * (تسوية لصاحب المخزون في الشراكة بتاريخ آخر دفعة)، وغير كده بتفضل لسه متدفعتش.
 * لازم تتنده جوه مخزن الفاتورة (الفاتورة بتتقري منه).
 */
export function syncSalePayments(saleId: number): void {
  const transfers = repo.findBySale(saleId)
  if (transfers.length === 0) return
  const sale = salesRepo.findById(saleId)
  const settled = !!sale && sale.total - sale.returns_total > EPS && sale.remaining <= EPS
  const date = sale?.payments.reduce((last, p) => (p.payment_date > last ? p.payment_date : last), sale.sale_date) ?? ''

  for (const t of transfers) {
    partnersRepo.removeTransferPayments(t.id)
    if (!settled || t.total_price <= 0 || !t.partner_id) continue
    const partnership = partnershipOf(t.from_workspace_id, t.to_workspace_id)
    partnersRepo.insertPayment({
      workspace_id: partnership,
      partner_id: t.partner_id,
      // للشراكة = الشراكة دفعت لصاحب المخزون، من الشراكة = صاحب المخزون دفع للشراكة
      amount: t.to_workspace_id === partnership ? t.total_price : -t.total_price,
      payment_date: date,
      notes: null,
      transfer_id: t.id
    })
  }
}

/** كام قطعة من المنتج ده في الفاتورة جاية من مخزن تاني ولسه ممكن ترجع له */
export const returnableToSource = (saleId: number, itemId: number, condition: Condition) =>
  repo.saleTransferLines(saleId, itemId, condition).reduce((sum, l) => sum + l.quantity, 0)

/**
 * مرتجع للمخزن الأصلي: القطع بترجع للمصدر بتكلفتها الأصلية (من غير ما تدخل مخزن الفاتورة)،
 * والتحويل بيقل بيها (فالمستحق على مخزن الفاتورة بيقل).
 */
export function returnToSaleSource(saleId: number, itemId: number, condition: Condition, quantity: number): void {
  let left = quantity
  const touched = new Set<number>()
  for (const l of repo.saleTransferLines(saleId, itemId, condition)) {
    const q = Math.min(left, l.quantity)
    if (q <= 0) continue
    returnToSource(l.from_workspace_id, [{ ...l, quantity: q }])
    repo.addReturned(l.id, q)
    touched.add(l.transfer_id)
    left -= q
  }
  if (left > 0) throw new AppError('RETURN_EXCEEDS_SOURCE')
  touched.forEach(repo.recalcTotals)
}

/** إلغاء مرتجع للمصدر (حذف المرتجع): القطع بتتسحب من المصدر تاني بتكلفتها وبترجع على التحويل */
export function undoReturnToSaleSource(saleId: number, itemId: number, condition: Condition, quantity: number): void {
  let left = quantity
  const touched = new Set<number>()
  for (const l of repo.saleTransferLines(saleId, itemId, condition)) {
    const q = Math.min(left, l.returned)
    if (q <= 0) continue
    withWorkspace(l.from_workspace_id, () => {
      const stock = itemStock.getStock(l.from_item_id, l.condition)
      if (!stock || stock.quantity < q) throw new AppError('OUT_OF_STOCK')
      itemStock.setPrices(l.from_item_id, l.condition, { purchase_price: removeFromAverage(stock.quantity, stock.purchase_price, q, l.unit_cost) })
      itemStock.changeStock(l.from_item_id, l.condition, -q)
    })
    repo.addReturned(l.id, -q)
    touched.add(l.transfer_id)
    left -= q
  }
  touched.forEach(repo.recalcTotals)
}
