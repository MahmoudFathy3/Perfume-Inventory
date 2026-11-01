import clsx from 'clsx'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { Condition, MovementType, PriceType } from '@shared/types'

export type BadgeTone = 'green' | 'amber' | 'indigo' | 'teal' | 'sky' | 'purple' | 'pink' | 'rose' | 'slate'

const tones: Record<BadgeTone, string> = {
  green: 'bg-green-100 text-green-800',
  amber: 'bg-orange-100 text-orange-800',
  indigo: 'bg-indigo-100 text-indigo-800',
  teal: 'bg-teal-100 text-teal-800',
  sky: 'bg-sky-100 text-sky-800',
  purple: 'bg-purple-100 text-purple-800',
  pink: 'bg-pink-100 text-pink-800',
  rose: 'bg-rose-100 text-rose-800',
  slate: 'bg-slate-100 text-slate-700'
}

export function Badge({ tone = 'slate', className, children }: { tone?: BadgeTone; className?: string; children: ReactNode }) {
  return <span className={clsx('inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold', tones[tone], className)}>{children}</span>
}

// ---------- شارات جاهزة للحالات الشائعة ----------
const conditionTone: Record<Condition, BadgeTone> = { new: 'green', damaged: 'amber' }
const movementTone: Record<MovementType, BadgeTone> = { purchase: 'indigo', sale: 'teal', sale_return: 'amber', purchase_return: 'pink', transfer_in: 'sky', transfer_out: 'purple' }
const priceTone: Record<PriceType, BadgeTone> = { retail: 'sky', wholesale: 'purple' }

export function ConditionBadge({ condition }: { condition: Condition }) {
  const { t } = useTranslation()
  return <Badge tone={conditionTone[condition]}>{t(`condition.${condition}`)}</Badge>
}

export function MovementBadge({ type }: { type: MovementType }) {
  const { t } = useTranslation()
  return <Badge tone={movementTone[type]}>{t(`details.types.${type}`)}</Badge>
}

export function PriceTypeBadge({ type }: { type: PriceType }) {
  const { t } = useTranslation()
  return <Badge tone={priceTone[type]}>{t(`sales.${type}`)}</Badge>
}

/** حالة سداد فاتورة بيع: مدفوعة / مدفوعة جزئيًا / غير مدفوعة */
export function PaymentStatusBadge({ paid, remaining }: { paid: number; remaining: number }) {
  const { t } = useTranslation()
  const status = remaining <= 0 ? 'paid' : paid > 0 ? 'partial' : 'unpaid'
  const tone: Record<typeof status, BadgeTone> = { paid: 'green', partial: 'amber', unpaid: 'rose' }
  return <Badge tone={tone[status]}>{t(`payment.${status}`)}</Badge>
}
