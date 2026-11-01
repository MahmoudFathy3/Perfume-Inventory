import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import type { Condition, ExportLabels } from '@shared/types'
import { closeDb, getDb, openDb } from '../database/connection'
import { migrate } from '../database/migrate'

/** داتا بيز مؤقتة لملف الاختبار: بتتفتح قبل الاختبارات وبتتمسح بعدها. اندهيها مرة واحدة في أول الملف. */
export function useTestDb(): { dbFile: string } {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'inv-'))
  const dbFile = path.join(tmp, 'inventory.sqlite')
  test.before(() => {
    openDb(dbFile)
    migrate(getDb())
  })
  test.after(() => {
    closeDb()
    fs.rmSync(tmp, { recursive: true, force: true })
  })
  return { dbFile }
}

export interface StockRow {
  quantity: number
  purchase_price: number
  selling_price: number
  wholesale_price: number
}

/** صف المخزون لمنتج وحالة */
export const stockOf = (itemId: number, cond: Condition) =>
  getDb().prepare('SELECT * FROM item_stock WHERE item_id = ? AND condition = ?').get(itemId, cond) as StockRow

/** كود الخطأ اللي الدالة بترميه (أو undefined لو نجحت) */
export const err = (fn: () => unknown): string | undefined => {
  try {
    fn()
  } catch (e) {
    return (e as { code?: string }).code
  }
  return undefined
}

export const round = (n: number) => Math.round(n * 100) / 100
export const one = <T>(sql: string, ...params: unknown[]) => getDb().prepare(sql).get(...params) as T

/** ترجمات عناوين التصدير */
export const labels: ExportLabels = {
  sheets: { purchases: 'المشتريات', purchase_items: 'تفاصيل المشتريات', items: 'المنتجات', movements: 'الحركات', sales: 'المبيعات', sale_items: 'تفاصيل المبيعات', returns: 'المرتجعات', categories: 'الأصناف', customers: 'العملاء', payments: 'الدفعات', category_items: 'منتجات الصنف', item_movements: 'حركات المنتجات', product: 'بيانات المنتج', summary: 'ملخص المنتج' },
  columns: { field: 'البند', value: 'القيمة', id: 'رقم', date: 'التاريخ', supplier: 'المورد', total: 'الإجمالي', name_ar: 'الاسم عربي', condition: 'الحالة', quantity: 'الكمية', name: 'الاسم', type: 'النوع', status: 'الحالة العامة', shipping_payer: 'الشحن على', profit: 'الربح' },
  values: { new: 'جديد', damaged: 'تالف', sale: 'بيع', purchase: 'شراء', customer: 'العميل', shop: 'المحل', active: 'نشط', archived: 'مؤرشف' }
}
