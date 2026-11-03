import type { CustomerInput, CustomerStatement, PageParams } from '@shared/types'
import { AppError, round2 } from '../../lib/errors'
import { findByCustomer, refundsByCustomer } from '../payments/payments.repository'
import * as salesRepo from '../sales/sales.repository'
import * as repo from './customers.repository'

/** بيانات العميل: الاسم مطلوب ومينفعش يتكرر */
function clean(input: CustomerInput, excludeId = 0): { name: string; phone: string | null } {
  const name = String(input.name ?? '').trim()
  if (!name) throw new AppError('NAME_REQUIRED')
  if (repo.findByName(name, excludeId)) throw new AppError('DUPLICATE_NAME')
  return { name, phone: String(input.phone ?? '').trim() || null }
}

export const listCustomers = (p: { search?: string; owing?: boolean }) => repo.findAll(p)
export const pageCustomers = (p: { search?: string; owing?: boolean } & PageParams) => repo.findPage(p, p)

export function createCustomer(input: CustomerInput): number {
  const { name, phone } = clean(input)
  return repo.insert(name, phone)
}

export function updateCustomer({ id, ...input }: CustomerInput & { id: number }): void {
  const { name, phone } = clean(input, id)
  repo.update(id, name, phone)
}

/** العميل اللي ليه فواتير مينفعش يتحذف (الـ IPC بيحوّل الخطأ لـ IN_USE) */
export const removeCustomer = ({ id }: { id: number }) => repo.remove(id)

/** كشف حساب العميل: فواتيره ودفعاته والمتبقي */
export function getStatement({ id }: { id: number }): CustomerStatement {
  const customer = repo.findById(id)
  if (!customer) throw new AppError('CUSTOMER_NOT_FOUND')
  const sales = salesRepo.findAll({ customerId: id })
  const sum = (pick: (s: (typeof sales)[number]) => number) => round2(sales.reduce((acc, s) => acc + pick(s), 0))
  return {
    customer,
    // paid = اللي دفعه فعلًا (قبل الردود)، refunded = اترد كاش، credit_used = اتخصم من رصيده في فواتير تانية
    totals: {
      total: sum((s) => s.total),
      paid: sum((s) => s.paid + s.refunded + s.credit_used),
      returns: sum((s) => s.returns_total),
      remaining: sum((s) => s.remaining),
      credit: sum((s) => s.credit),
      refunded: sum((s) => s.refunded)
    },
    sales,
    payments: findByCustomer(id),
    refunds: refundsByCustomer(id)
  }
}
