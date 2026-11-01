import ExcelJS from 'exceljs'
import type { CellValue, ExportColumn, ExportLabels, ExportSheet } from '@shared/types'

const HEADER_FILL = 'FF0D9488'
const FORBIDDEN_SHEET_CHARS = /[\\/?*[\]:]/g

/** القيمة اللي هتتكتب في الخلية (الحالات بتتترجم بلغة التطبيق) */
function displayValue(col: ExportColumn, value: CellValue, labels: ExportLabels): CellValue {
  if (value === null || value === undefined) return ''
  return col.type === 'enum' ? (labels.values[String(value)] ?? value) : value
}

const columnLabel = (col: ExportColumn, labels: ExportLabels) => labels.columns[col.key] ?? col.key
const sheetTitle = (sheet: ExportSheet, labels: ExportLabels) => labels.sheets[sheet.key] ?? sheet.key
const isRecord = (sheet: ExportSheet) => sheet.layout === 'record'

// ---------- CSV ----------
const csvCell = (v: CellValue): string => {
  const text = v === null ? '' : String(v)
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

const csvLine = (cells: CellValue[]) => cells.map(csvCell).join(',')

function csvLines(sheet: ExportSheet, labels: ExportLabels): string[] {
  if (isRecord(sheet)) {
    const row = sheet.rows[0] ?? {}
    return [
      csvLine([labels.columns.field ?? 'field', labels.columns.value ?? 'value']),
      ...sheet.columns.map((c) => csvLine([columnLabel(c, labels), displayValue(c, row[c.key] ?? null, labels)]))
    ]
  }
  return [
    csvLine(sheet.columns.map((c) => columnLabel(c, labels))),
    ...sheet.rows.map((row) => csvLine(sheet.columns.map((c) => displayValue(c, row[c.key] ?? null, labels))))
  ]
}

/**
 * CSV بـ UTF-8 مع BOM علشان إكسيل يعرض العربي صح.
 * كل الشيتات في ملف واحد: عنوان الجدول، وبعده الجدول، وسطر فاضي بين كل جدول والتاني.
 */
export function buildCsv(sheets: ExportSheet[], labels: ExportLabels): string {
  const blocks = sheets.map((sheet) => [csvLine([sheetTitle(sheet, labels)]), ...csvLines(sheet, labels)].join('\r\n'))
  return `\uFEFF${blocks.join('\r\n\r\n')}\r\n`
}

// ---------- Excel ----------
const NUMBER_FORMATS: Partial<Record<ExportColumn['type'], string>> = {
  money: '#,##0.00',
  number: '#,##0',
  date: 'dd/mm/yyyy'
}

function excelValue(col: ExportColumn, value: CellValue, labels: ExportLabels): ExcelJS.CellValue {
  const v = displayValue(col, value, labels)
  if (col.type === 'date' && typeof v === 'string' && v) return new Date(`${v.slice(0, 10)}T00:00:00`)
  return v
}

function styleHeader(row: ExcelJS.Row): void {
  row.height = 22
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
  })
}

function addTableSheet(wb: ExcelJS.Workbook, sheet: ExportSheet, labels: ExportLabels, rtl: boolean): void {
  const ws = wb.addWorksheet(excelName(sheet, labels), { views: [{ rightToLeft: rtl, state: 'frozen', ySplit: 1 }] })
  ws.columns = sheet.columns.map((c) => ({ key: c.key, header: columnLabel(c, labels), width: c.width, style: { numFmt: NUMBER_FORMATS[c.type] } }))
  for (const row of sheet.rows) ws.addRow(Object.fromEntries(sheet.columns.map((c) => [c.key, excelValue(c, row[c.key] ?? null, labels)])))
  styleHeader(ws.getRow(1))
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columns.length } }
}

/** صف واحد بيتعرض كـ (البند | القيمة) */
function addRecordSheet(wb: ExcelJS.Workbook, sheet: ExportSheet, labels: ExportLabels, rtl: boolean): void {
  const ws = wb.addWorksheet(excelName(sheet, labels), { views: [{ rightToLeft: rtl, state: 'frozen', ySplit: 1 }] })
  ws.columns = [
    { key: 'field', header: labels.columns.field ?? 'field', width: 30 },
    { key: 'value', header: labels.columns.value ?? 'value', width: 30 }
  ]
  const row = sheet.rows[0] ?? {}
  for (const c of sheet.columns) {
    const added = ws.addRow({ field: columnLabel(c, labels), value: excelValue(c, row[c.key] ?? null, labels) })
    added.getCell(2).numFmt = NUMBER_FORMATS[c.type] ?? 'General'
    added.getCell(2).alignment = { horizontal: 'left' }
    added.getCell(1).font = { bold: true }
  }
  styleHeader(ws.getRow(1))
}

const excelName = (sheet: ExportSheet, labels: ExportLabels) => sheetTitle(sheet, labels).replace(FORBIDDEN_SHEET_CHARS, ' ').slice(0, 31)

export async function buildXlsx(sheets: ExportSheet[], labels: ExportLabels, rtl: boolean): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Inventory'
  for (const sheet of sheets) (isRecord(sheet) ? addRecordSheet : addTableSheet)(wb, sheet, labels, rtl)
  return Buffer.from(await wb.xlsx.writeBuffer())
}
