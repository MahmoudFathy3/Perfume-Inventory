import type { ClosedMonth, DashboardRange, MonthlyClosing, PartnerLedger, PartnerPaymentInput, PartnerSales, PartnerStatement, PartnerTransferInput } from '@shared/types'
import { invoke } from '@/shared/api/ipc'

export const partnersApi = {
  ledger: () => invoke<PartnerLedger>('partners:ledger'),
  /** كشف حساب شريك واحد بالتفصيل (الباقي جاي منين) */
  statement: (p: { partner_id: number }) => invoke<PartnerStatement>('partners:statement', p),
  /** مبيعات كل شريك في الفترة */
  sales: (p: DashboardRange) => invoke<PartnerSales[]>('partners:sales', p),
  /** تقفيل شهر (YYYY-MM): أرقام الشهر وحساب كل شريك فيه */
  closing: (p: { month: string }) => invoke<MonthlyClosing>('partners:closing', p),
  /** قفل الشهر (لازم يكون خلص وكله مدفوع): أرقامه بتتحفظ ومفيش تعديل فيه */
  closeMonth: (p: { month: string; notes?: string }) => invoke<void>('partners:close-month', p),
  reopenMonth: (p: { month: string }) => invoke<void>('partners:reopen-month', p),
  /** تسوية الكل: كل شريك بياخد الباقي له (أو بيدفع اللي عليه) بتاريخ آخر الشهر */
  settleMonth: (p: { month: string; notes?: string }) => invoke<{ partner_id: number; amount: number }[]>('partners:settle-month', p),
  /** الشهور المقفولة: كل شريك خد كام وفضل له كام */
  closedMonths: () => invoke<ClosedMonth[]>('partners:closed-months'),
  // ---------- التقفيل اليومي في حسابات الشركاء (القفل نفسه بتاع التقفيل اليومي) ----------
  dayClosing: (p: { day: string }) => invoke<MonthlyClosing>('partners:day-closing', p),
  settleDay: (p: { day: string; notes?: string }) => invoke<{ partner_id: number; amount: number }[]>('partners:settle-day', p),
  closeDay: (p: { day: string; notes?: string }) => invoke<void>('daily:close', p),
  reopenDay: (p: { day: string }) => invoke<void>('daily:reopen', p),
  /** الأيام المقفولة: كل شريك خد كام وفضل له كام */
  closedDays: () => invoke<ClosedMonth[]>('partners:closed-days'),
  pay: (p: PartnerPaymentInput) => invoke<number>('partners:pay', p),
  removePayment: (p: { id: number }) => invoke<void>('partners:remove-payment', p),
  /** تسوية بين الشريكين (واحد دفع للتاني من جيبه) */
  transfer: (p: PartnerTransferInput) => invoke<number>('partners:transfer', p)
}
