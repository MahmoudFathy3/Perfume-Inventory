import clsx from 'clsx'
import { useTranslation } from 'react-i18next'
import type { Condition, Item } from '@shared/types'
import { ConditionBadge } from '@/shared/components/ui'
import { formatMoney, formatNumber } from '@/shared/utils/format'

const tone: Record<Condition, string> = {
  new: 'border-green-200 bg-green-50 text-green-800',
  damaged: 'border-orange-200 bg-orange-50 text-orange-800'
}

/** ملخص مخزون حالة واحدة (جديد / تالف) في صفحة تفاصيل المنتج */
export function StockSummary({ condition, item }: { condition: Condition; item: Item }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const quantity = item[`${condition}_quantity`]
  // كل سعر ومعاه إجمالي فلوس القطع اللي في المخزن بيه (العدد × السعر)
  const rows = [
    { label: t('details.avgCost'), value: item[`${condition}_purchase_price`] },
    { label: t('items.sellingPrice'), value: item[`${condition}_selling_price`] },
    { label: t('items.wholesalePrice'), value: item[`${condition}_wholesale_price`] }
  ]
  return (
    <section className={clsx('rounded-2xl border px-[18px] py-3.5', tone[condition])}>
      <header className="mb-2.5 flex items-center justify-between">
        <ConditionBadge condition={condition} />
        <strong className="text-3xl text-slate-900">{formatNumber(quantity, lang)}</strong>
      </header>
      <dl className="grid grid-cols-3 gap-2">
        {rows.map((r) => (
          <div key={r.label}>
            <dt className="text-xs opacity-80">{r.label}</dt>
            <dd className="mt-0.5 font-bold text-slate-900">{formatMoney(r.value, lang)}</dd>
            <dd className="mt-1 border-t border-current/20 pt-1 text-xs">
              <span className="opacity-80">{t('details.piecesTotal', { count: quantity })}</span>
              <strong className="block text-sm text-slate-900">{formatMoney(quantity * r.value, lang)}</strong>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
