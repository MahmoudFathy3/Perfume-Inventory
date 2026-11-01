import type { CellType, CellValue, ExportColumn, ExportParams } from '@shared/types'

export type Row = Record<string, CellValue>

/** شيت واحد في التصدير: أعمدته وصفوفه */
export interface SheetDef {
  key: string
  layout?: 'table' | 'record'
  /** دالة لو الأعمدة بتختلف حسب المخزن النشط */
  columns: ExportColumn[] | (() => ExportColumn[])
  rows: (params: ExportParams) => Row[]
}

/** تعريف عمود: [المفتاح، النوع، العرض في إكسيل] */
export const col = (key: string, type: CellType = 'text', width = 16): ExportColumn => ({ key, type, width })
