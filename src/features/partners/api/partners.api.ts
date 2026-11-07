import type { DashboardRange, PartnerLedger, PartnerPaymentInput, PartnerSales, PartnerStatement, PartnerTransferInput } from '@shared/types'
import { invoke } from '@/shared/api/ipc'

export const partnersApi = {
  ledger: () => invoke<PartnerLedger>('partners:ledger'),
  /** كشف حساب شريك واحد بالتفصيل (الباقي جاي منين) */
  statement: (p: { partner_id: number }) => invoke<PartnerStatement>('partners:statement', p),
  /** مبيعات كل شريك في الفترة */
  sales: (p: DashboardRange) => invoke<PartnerSales[]>('partners:sales', p),
  pay: (p: PartnerPaymentInput) => invoke<number>('partners:pay', p),
  removePayment: (p: { id: number }) => invoke<void>('partners:remove-payment', p),
  /** تسوية بين الشريكين (واحد دفع للتاني من جيبه) */
  transfer: (p: PartnerTransferInput) => invoke<number>('partners:transfer', p)
}
