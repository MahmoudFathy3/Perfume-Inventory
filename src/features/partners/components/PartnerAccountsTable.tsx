import { HandCoins } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { PartnerAccount } from '@shared/types'
import { Button, DataTable } from '@/shared/components/ui'
import type { Column } from '@/shared/components/ui'
import { formatMoney } from '@/shared/utils/format'

interface PartnerAccountsTableProps {
  rows: PartnerAccount[]
  onSettle: (row: PartnerAccount) => void
}

/** كشف حساب كل شريك: رأس ماله، اللي باعه للشراكة، نصيبه من الربح، اللي اتسوّى، والمستحق */
export function PartnerAccountsTable({ rows, onSettle }: PartnerAccountsTableProps) {
  const { t, i18n } = useTranslation()
  const money = (v: number) => formatMoney(v, i18n.language)

  const columns: Column<PartnerAccount>[] = [
    { key: 'name', header: t('partners.partner'), cell: (a) => <strong>{a.partner.name}</strong> },
    { key: 'capital', header: t('partners.capital'), cell: (a) => money(a.capital) },
    { key: 'sold', header: t('partners.sold'), cell: (a) => money(a.sold) },
    { key: 'share', header: t('partners.profitShare'), cell: (a) => money(a.profit_share) },
    { key: 'settled', header: t('partners.settled'), cell: (a) => money(a.settled) },
    {
      key: 'balance',
      header: t('partners.balance'),
      cell: (a) => (
        <span className={a.balance < 0 ? 'text-rose-600' : 'text-green-700'}>
          <strong>{money(Math.abs(a.balance))}</strong>{' '}
          <small>{a.balance === 0 ? '' : t(a.balance > 0 ? 'partners.owedToPartner' : 'partners.owedByPartner')}</small>
        </span>
      )
    },
    { key: 'actions', header: '', cell: (a) => <Button size="sm" icon={HandCoins} onClick={() => onSettle(a)}>{t('partners.settle')}</Button> }
  ]

  return <DataTable columns={columns} rows={rows} rowKey={(a) => a.partner.id} />
}
