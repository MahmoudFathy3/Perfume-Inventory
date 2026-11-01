import type { ExportColumn, Item } from '@shared/types'
import { findMovements } from '../../items/movements.repository'
import { type Row, col } from './sheet'

export const ITEM_COLUMNS: ExportColumn[] = [
  col('name_ar', 'text', 26), col('name_en', 'text', 26), col('category', 'text', 20),
  col('new_quantity', 'number', 12), col('new_purchase_price', 'money'), col('new_selling_price', 'money'), col('new_wholesale_price', 'money'), col('new_stock_value', 'money'),
  col('damaged_quantity', 'number', 12), col('damaged_purchase_price', 'money'), col('damaged_selling_price', 'money'), col('damaged_wholesale_price', 'money'), col('damaged_stock_value', 'money'),
  col('total_quantity', 'number', 12), col('stock_value', 'money'), col('expected_profit', 'money')
]

export function itemRow(i: Item): Row {
  const newValue = i.new_quantity * i.new_purchase_price
  const damagedValue = i.damaged_quantity * i.damaged_purchase_price
  const sellingValue = i.new_quantity * i.new_selling_price + i.damaged_quantity * i.damaged_selling_price
  return {
    name_ar: i.name_ar, name_en: i.name_en, category: i.category_name,
    new_quantity: i.new_quantity, new_purchase_price: i.new_purchase_price, new_selling_price: i.new_selling_price, new_wholesale_price: i.new_wholesale_price, new_stock_value: newValue,
    damaged_quantity: i.damaged_quantity, damaged_purchase_price: i.damaged_purchase_price, damaged_selling_price: i.damaged_selling_price, damaged_wholesale_price: i.damaged_wholesale_price, damaged_stock_value: damagedValue,
    total_quantity: i.new_quantity + i.damaged_quantity, stock_value: newValue + damagedValue, expected_profit: sellingValue - (newValue + damagedValue)
  }
}

export const MOVEMENT_COLUMNS: ExportColumn[] = [
  col('date', 'date'), col('type', 'enum', 16), col('invoice', 'number', 10), col('party', 'text', 24),
  col('condition', 'enum', 12), col('quantity', 'number', 10), col('unit_price', 'money'), col('unit_cost', 'money'),
  col('line_total', 'money'), col('profit', 'money')
]

/** حركات منتج: الكمية بعلامة (+ داخل / − خارج) والربح للبيع ومرتجع البيع */
export function movementRows(itemId: number): Row[] {
  return findMovements(itemId).map((m) => {
    const lineTotal = m.quantity * m.unit_price
    const gain = m.quantity * (m.unit_price - m.unit_cost)
    return {
      date: m.date, type: m.type, invoice: m.ref_id, party: m.party, condition: m.condition,
      quantity: m.direction * m.quantity, unit_price: m.unit_price, unit_cost: m.unit_cost, line_total: lineTotal,
      profit: m.type === 'sale' ? gain : m.type === 'sale_return' ? -gain : null
    }
  })
}
