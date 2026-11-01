import clsx from 'clsx'
import { useTranslation } from 'react-i18next'
import type { Movement } from '@shared/types'
import { Button, ConditionBadge, DataTable, MovementBadge } from '@/shared/components/ui'
import type { Column } from '@/shared/components/ui'
import { formatDate, formatMoney, formatNumber } from '@/shared/utils/format'

interface MovementsTableProps {
  rows: Movement[]
  onOpenInvoice: (movement: Movement) => void
}

export function MovementsTable({ rows, onOpenInvoice }: MovementsTableProps) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language

  const columns: Column<Movement>[] = [
    { key: 'date', header: t('common.date'), cell: (m) => formatDate(m.date) },
    { key: 'type', header: t('details.type'), cell: (m) => <MovementBadge type={m.type} /> },
    { key: 'invoice', header: t('details.invoice'), cell: (m) => (m.type.startsWith('transfer') ? `#${m.ref_id}` : <Button variant="link" onClick={() => onOpenInvoice(m)}>#{m.ref_id}</Button>) },
    { key: 'party', header: t('details.party'), cell: (m) => m.party },
    { key: 'condition', header: t('condition.label'), cell: (m) => <ConditionBadge condition={m.condition} /> },
    {
      key: 'quantity',
      header: t('common.quantity'),
      cell: (m) => (
        <span className={clsx('font-bold', m.direction > 0 ? 'text-green-800' : 'text-rose-700')}>
          {m.direction > 0 ? '+' : '−'}{formatNumber(m.quantity, lang)}
        </span>
      )
    },
    { key: 'unit', header: t('details.unitPrice'), cell: (m) => formatMoney(m.unit_price, lang) },
    { key: 'total', header: t('details.lineTotal'), cell: (m) => formatMoney(m.total, lang) }
  ]

  return <DataTable columns={columns} rows={rows} rowKey={(m, i) => `${m.type}-${m.ref_id}-${m.condition}-${i}`} emptyText={t('details.noMovements')} />
}
