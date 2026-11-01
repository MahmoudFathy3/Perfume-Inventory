import type { CellValue, ExportColumn, ExportLabels, ExportSheet } from '@shared/types'
import { formatDate, formatMoney, formatNumber } from '../utils/format'

interface PrintableReportProps {
  title: string
  sheets: ExportSheet[]
  labels: ExportLabels
  lang: string
}

function cellText(col: ExportColumn, value: CellValue, labels: ExportLabels, lang: string): string {
  if (value === null || value === undefined || value === '') return ''
  switch (col.type) {
    case 'money':
      return formatMoney(Number(value), lang)
    case 'number':
      return formatNumber(Number(value), lang)
    case 'date':
      return formatDate(String(value))
    case 'enum':
      return labels.values[String(value)] ?? String(value)
    default:
      return String(value)
  }
}

const th = 'border border-slate-400 bg-slate-100 px-2 py-1.5 text-start font-bold'
const td = 'border border-slate-300 px-2 py-1'

/** جدول عادي */
function TableSheet({ sheet, labels, lang }: { sheet: ExportSheet; labels: ExportLabels; lang: string }) {
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr>
          {sheet.columns.map((c) => (
            <th key={c.key} className={th}>{labels.columns[c.key] ?? c.key}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sheet.rows.map((row, i) => (
          <tr key={i}>
            {sheet.columns.map((c) => (
              <td key={c.key} className={td}>{cellText(c, row[c.key] ?? null, labels, lang)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** صف واحد بيتعرض كـ (البند | القيمة) */
function RecordSheet({ sheet, labels, lang }: { sheet: ExportSheet; labels: ExportLabels; lang: string }) {
  const row = sheet.rows[0] ?? {}
  return (
    <table className="w-full max-w-[520px] border-collapse">
      <tbody>
        {sheet.columns.map((c) => (
          <tr key={c.key}>
            <th className={`${th} w-1/2`}>{labels.columns[c.key] ?? c.key}</th>
            <td className={td}>{cellText(c, row[c.key] ?? null, labels, lang)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** تقرير للطباعة / PDF: كل الجداول (الجدول الأساسي وتفاصيله) واحد ورا التاني */
export function PrintableReport({ title, sheets, labels, lang }: PrintableReportProps) {
  return (
    <div className="text-xs text-black">
      <h1 className="mb-4 text-xl">{title}</h1>
      {sheets.map((sheet) => (
        <section key={sheet.key} className="mb-6 break-inside-auto">
          <h2 className="mb-2 text-[15px]">{labels.sheets[sheet.key] ?? sheet.key}</h2>
          {sheet.layout === 'record' ? <RecordSheet sheet={sheet} labels={labels} lang={lang} /> : <TableSheet sheet={sheet} labels={labels} lang={lang} />}
        </section>
      ))}
    </div>
  )
}
