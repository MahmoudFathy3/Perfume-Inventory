import { useTranslation } from 'react-i18next'
import type { TransferKind, TransfersFilter, TransferSummaryRow } from '@shared/types'
import { Badge, Card } from '@/shared/components/ui'
import type { BadgeTone } from '@/shared/components/ui'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { useQuery } from '@/shared/hooks/useQuery'
import { formatNumber } from '@/shared/utils/format'
import { transfersApi } from '../api/transfers.api'

const kindTone: Record<TransferKind, BadgeTone> = { capital: 'indigo', sale: 'teal', half: 'slate' }

interface PersonRow {
  key: string
  name: string | null
  pieces: number
  transfers: number
  kinds: { kind: TransferKind; pieces: number }[]
}

/** صفوف اتجاه واحد متجمّعة بالشخص (مع تفصيل كل نوع) */
function byPerson(rows: TransferSummaryRow[]): PersonRow[] {
  const people = new Map<string, PersonRow>()
  for (const r of rows) {
    const key = String(r.partner_id ?? 'none')
    const p = people.get(key) ?? { key, name: r.partner_name, pieces: 0, transfers: 0, kinds: [] }
    p.pieces += r.pieces
    p.transfers += r.transfers
    p.kinds.push({ kind: r.kind, pieces: r.pieces })
    people.set(key, p)
  }
  return [...people.values()].sort((a, b) => b.pieces - a.pieces)
}

/**
 * ملخص التحويلات بنفس فلتر الجدول: عدد القطع اللي طلعت من المخزن الحالي واللي دخلت عليه،
 * لكل شخص (صاحب رأس المال / البائع / المشتري) ومتقسّمة بالنوع. "بالنص" ملوش شخص.
 * refreshKey بيتغيّر بعد أي حفظ أو حذف علشان الأرقام تتحدّث.
 */
export function TransfersSummary({ filter, storeName, refreshKey }: { filter: TransfersFilter; storeName: string; refreshKey: number }) {
  const { t, i18n } = useTranslation()
  const search = useDebounce(filter.search ?? '')
  const params = { ...filter, search }
  const { data } = useQuery(() => transfersApi.summary(params), [JSON.stringify(params), refreshKey])
  if (!data || data.length === 0) return null
  const num = (v: number) => formatNumber(v, i18n.language)

  const sides = (['out', 'in'] as const).map((direction) => {
    const rows = data.filter((r) => r.direction === direction)
    return {
      direction,
      title: t(direction === 'out' ? 'transfers.outOf' : 'transfers.inTo', { name: storeName }),
      pieces: rows.reduce((sum, r) => sum + r.pieces, 0),
      transfers: rows.reduce((sum, r) => sum + r.transfers, 0),
      people: byPerson(rows)
    }
  })

  return (
    <section className="mb-3.5">
      <h2 className="mb-2.5">{t('transfers.summary')} <small className="font-normal text-slate-500">— {t('transfers.summaryNote')}</small></h2>
      <div className="grid gap-3.5 lg:grid-cols-2">
        {sides.map((side) => (
          <Card key={side.direction} className="!p-0">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 px-4 py-3">
              <h3>{side.title}</h3>
              <span className="text-sm text-slate-500">
                <strong className="text-lg text-primary-700">{t('transfers.piecesCount', { count: side.pieces, value: num(side.pieces) })}</strong>
                {' · '}
                {t('transfers.transfersCount', { count: side.transfers, value: num(side.transfers) })}
              </span>
            </div>
            {side.people.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-500">{t('transfers.nothing')}</p>
            ) : (
              <ul className="divide-y divide-slate-100 text-sm">
                {side.people.map((p) => (
                  <li key={p.key} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 px-4 py-2.5">
                    <span className="min-w-0">
                      <strong>{p.name ?? t('transfers.noPartner')}</strong>
                      <span className="ms-2 inline-flex flex-wrap gap-1 align-middle">
                        {p.kinds.map((k) => (
                          <Badge key={k.kind} tone={kindTone[k.kind]}>{t(`transfers.kinds.${k.kind}`)}: {num(k.pieces)}</Badge>
                        ))}
                      </span>
                    </span>
                    <span className="whitespace-nowrap text-slate-600">
                      <strong className="text-slate-900">{t('transfers.piecesCount', { count: p.pieces, value: num(p.pieces) })}</strong>
                      {' · '}
                      {t('transfers.transfersCount', { count: p.transfers, value: num(p.transfers) })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ))}
      </div>
    </section>
  )
}
