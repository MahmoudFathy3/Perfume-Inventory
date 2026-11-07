import type {
  DateFilter,
  FreeInvoice,
  FreeInvoiceInput,
  FreeInvoicePaymentInput,
  FreeInvoiceToSaleInput,
  FreeInvoiceWithLines,
  Page,
  PageParams
} from '@shared/types'
import { invoke } from '@/shared/api/ipc'

export const freeInvoicesApi = {
  page: (p: { search?: string } & DateFilter & PageParams) => invoke<Page<FreeInvoice>>('free-invoices:page', p),
  get: (p: { id: number }) => invoke<FreeInvoiceWithLines>('free-invoices:get', p),
  create: (p: FreeInvoiceInput) => invoke<number>('free-invoices:create', p),
  update: (p: FreeInvoiceInput & { id: number }) => invoke<void>('free-invoices:update', p),
  remove: (p: { id: number }) => invoke<void>('free-invoices:remove', p),
  pay: (p: FreeInvoicePaymentInput) => invoke<number>('free-invoices:pay', p),
  removePayment: (p: { id: number }) => invoke<void>('free-invoices:remove-payment', p),
  /** فاتورة بيع حقيقية من بنود المخزون (بيرجّع رقمها) */
  toSale: (p: FreeInvoiceToSaleInput) => invoke<number>('free-invoices:to-sale', p)
}
