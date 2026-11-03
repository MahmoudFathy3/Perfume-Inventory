import type { ExportDataset, ExportParams, ExportSheet } from '@shared/types'
import { categoriesSheet, categoryItemsSheet } from './categories.sheets'
import { customersSheet, paymentsSheet } from './customers.sheets'
import { itemMovementsSheet, itemsSheet } from './items.sheets'
import { productMovementsSheet, productSheet, productSummarySheet } from './product.sheets'
import { purchaseItemsSheet, purchasesSheet } from './purchases.sheets'
import { returnItemsSheet, returnsSheet } from './returns.sheets'
import { saleItemsSheet, salesSheet } from './sales.sheets'
import type { SheetDef } from './sheet'

/** كل dataset = مجموعة شيتات (كل بيانات الجدول وتفاصيله). لإضافة جدول جديد: ملف sheets جديد وسطر هنا. */
export const DATASETS: Record<ExportDataset, SheetDef[]> = {
  categories: [categoriesSheet, categoryItemsSheet],
  items: [itemsSheet, itemMovementsSheet],
  purchases: [purchasesSheet, purchaseItemsSheet],
  sales: [salesSheet, saleItemsSheet],
  returns: [returnsSheet, returnItemsSheet],
  customers: [customersSheet, paymentsSheet],
  movements: [productSheet, productSummarySheet, productMovementsSheet]
}

export function loadSheets(dataset: ExportDataset, params: ExportParams): ExportSheet[] {
  return DATASETS[dataset].map((d) => ({ key: d.key, layout: d.layout ?? 'table', columns: typeof d.columns === 'function' ? d.columns() : d.columns, rows: d.rows(params) }))
}
