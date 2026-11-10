import { FileText, HandCoins, Info, ListTree } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { PartnerAccount } from '@shared/types'
import { Button, DataTable, RowActions } from '@/shared/components/ui'
import type { Column } from '@/shared/components/ui'
import { formatMoney } from '@/shared/utils/format'

interface PartnerAccountsTableProps {
  rows: PartnerAccount[]
  onSettle: (row: PartnerAccount) => void
  /** فتح كشف الحساب المفصّل (الباقي جاي منين) */
  onDetails: (row: PartnerAccount) => void
  /** فتح كشف حساب الشريك كعميل في المخزون الفعلي */
  onOpenStoreAccount: (customerId: number) => void
}

/** اسم العمود ومعاه علامة ⓘ بشرحه (بيظهر لما الماوس يقف عليها) */
function HintHeader({ label, hint }: { label: string; hint: string }) {
  return (
    <span className="inline-flex items-center gap-1" title={hint}>
      {label}
      <Info className="h-3.5 w-3.5 cursor-help text-slate-400" aria-label={hint} />
    </span>
  )
}

/** كشف حساب كل شريك: رأس ماله، اللي باعه للشراكة، نصيبه من الربح، اللي اتسوّى، والمستحق */
export function PartnerAccountsTable({ rows, onSettle, onDetails, onOpenStoreAccount }: PartnerAccountsTableProps) {
  const { t, i18n } = useTranslation()
  const money = (v: number) => formatMoney(v, i18n.language)

  const columns: Column<PartnerAccount>[] = [
    { key: 'name', header: t('partners.partner'), cell: (a) => <strong>{a.partner.name}</strong> },
    { key: 'capital', header: <HintHeader label={t('partners.capital')} hint={t('partners.capitalHint')} />, cell: (a) => money(a.capital) },
    { key: 'sold', header: <HintHeader label={t('partners.sold')} hint={t('partners.soldHint')} />, cell: (a) => money(a.sold) },
    { key: 'paidOut', header: <HintHeader label={t('partners.paidOut')} hint={t('partners.paidOutHint')} />, cell: (a) => money(a.paid_out) },
    { key: 'share', header: <HintHeader label={t('partners.profitShare')} hint={t('partners.profitShareHint')} />, cell: (a) => money(a.profit_share) },
    {
      key: 'settled',
      header: <HintHeader label={t('partners.settled')} hint={t('partners.settledHint')} />,
      // موجب = الشراكة دفعت له، سالب = هو دفع للشراكة: بنعرض المبلغ واتجاهه بدل الرقم السالب
      cell: (a) => (
        <span>
          {money(Math.abs(a.settled))}{' '}
          {a.settled !== 0 && <small className="text-slate-500">{t(a.settled > 0 ? 'partners.settledToPartner' : 'partners.settledFromPartner')}</small>}
        </span>
      )
    },
    {
      key: 'balance',
      header: <HintHeader label={t('partners.balance')} hint={t('partners.balanceHint')} />,
      cell: (a) => (
        <span className={a.balance < 0 ? 'text-rose-600' : 'text-green-700'}>
          <strong>{money(Math.abs(a.balance))}</strong>{' '}
          <small>{a.balance === 0 ? '' : t(a.balance > 0 ? 'partners.owedToPartner' : 'partners.owedByPartner')}</small>
        </span>
      )
    },
    {
      key: 'store',
      header: <HintHeader label={t('partners.storeAccount')} hint={t('partners.storeAccountHint')} />,
      cell: (a) => {
        const s = a.store_account
        if (!s) return <span className="text-slate-400">—</span>
        return (
          <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span>
              <strong className={s.remaining > 0 ? 'text-rose-600' : 'text-slate-500'}>{s.remaining > 0 ? money(s.remaining) : t('partners.storeNothing')}</strong>
              {s.sales_count > 0 && <small className="block text-slate-500">{t('partners.storeAccountSub', { count: s.sales_count, total: money(s.total) })}</small>}
            </span>
            <Button size="sm" variant="ghost" icon={FileText} onClick={() => onOpenStoreAccount(s.customer_id)}>{t('partners.storeStatement')}</Button>
          </span>
        )
      }
    },
    {
      key: 'actions',
      header: '',
      cell: (a) => (
        <RowActions>
          <Button size="sm" icon={ListTree} onClick={() => onDetails(a)}>{t('partners.statement.open')}</Button>
          <Button size="sm" icon={HandCoins} onClick={() => onSettle(a)}>{t('partners.settle')}</Button>
        </RowActions>
      )
    }
  ]

  return <DataTable columns={columns} rows={rows} rowKey={(a) => a.partner.id} />
}
