import clsx from 'clsx'
import { useTranslation } from 'react-i18next'
import { PAGE_SIZES } from '../../constants'
import type { PaginationState } from '../../hooks/usePagination'
import { Button, Select } from '../ui'

type Item = number | `gap-${number}`

/** أرقام الصفحات: 1 ... 4 5 6 ... 20 */
function pageList(page: number, count: number): Item[] {
  const set = new Set([1, count, page - 1, page, page + 1])
  const pages = [...set].filter((p) => p >= 1 && p <= count).sort((a, b) => a - b)
  const out: Item[] = []
  pages.forEach((p, i) => {
    if (i > 0 && p - pages[i - 1] > 1) out.push(`gap-${p}`)
    out.push(p)
  })
  return out
}

/** بياخد خرج usePagination مباشرة: <Pagination {...pagination} /> */
export function Pagination({ page, pageCount, pageSize, total, setPage, setPageSize }: Omit<PaginationState<unknown>, 'pageRows'>) {
  const { t } = useTranslation()
  if (total === 0) return null

  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  return (
    <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3 text-[13px]">
      <span className="text-slate-500">{t('common.showing', { from, to, total })}</span>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-1.5 whitespace-nowrap">
          <Select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="!min-w-[64px] !px-2 !py-1.5">
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </Select>
          <span className="text-slate-500">{t('common.perPage')}</span>
        </label>
        <div className="flex items-center gap-1">
          <Button size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>{t('common.prev')}</Button>
          {pageList(page, pageCount).map((p) =>
            typeof p === 'string' ? (
              <span key={p} className="text-slate-400">…</span>
            ) : (
              <Button key={p} size="sm" className={clsx('min-w-[34px]', p === page && '!border-primary-600 !bg-primary-600 font-bold !text-white')} onClick={() => setPage(p)}>
                {p}
              </Button>
            )
          )}
          <Button size="sm" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>{t('common.next')}</Button>
        </div>
      </div>
    </div>
  )
}
