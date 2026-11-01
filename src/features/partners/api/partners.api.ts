import type { PartnerLedger, PartnerPaymentInput } from '@shared/types'
import { invoke } from '@/shared/api/ipc'

export const partnersApi = {
  ledger: () => invoke<PartnerLedger>('partners:ledger'),
  pay: (p: PartnerPaymentInput) => invoke<number>('partners:pay', p),
  removePayment: (p: { id: number }) => invoke<void>('partners:remove-payment', p)
}
