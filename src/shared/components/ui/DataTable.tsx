import clsx from 'clsx'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { EmptyState } from './EmptyState'

export interface Column<T> {
  key: string
  header: ReactNode
  cell: (row: T) => ReactNode
  headerClassName?: string
  cellClassName?: string
}

interface DataTableProps<T> {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T, index: number) => string | number
  emptyText?: string
}

const th = 'border-b border-slate-200 bg-slate-50 px-3.5 py-3 text-start text-xs font-bold text-slate-500'
const td = 'border-b border-slate-200 px-3.5 py-3 text-start align-middle'

/** جدول موحّد: عرّف الأعمدة (header + cell) وهو يرسم الباقي */
export function DataTable<T>({ columns, rows, rowKey, emptyText }: DataTableProps<T>) {
  const { t } = useTranslation()
  if (rows.length === 0) return <EmptyState>{emptyText ?? t('common.noData')}</EmptyState>

  return (
    <div className="overflow-x-auto rounded-2xl bg-surface shadow-card">
    <table className="w-full border-separate border-spacing-0">
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c.key} className={clsx(th, c.headerClassName)}>
              {c.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="[&>tr:last-child>td]:border-b-0 [&>tr:hover>td]:bg-slate-50">
        {rows.map((row, i) => (
          <tr key={rowKey(row, i)}>
            {columns.map((c) => (
              <td key={c.key} className={clsx(td, c.cellClassName)}>
                {c.cell(row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  )
}

/** أزرار الإجراءات داخل خلية الجدول (تعديل / حذف...) */
export function RowActions({ children }: { children: ReactNode }) {
  return <div className="flex gap-1.5">{children}</div>
}
