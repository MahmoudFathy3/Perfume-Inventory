import { queryAll } from '../../../database/connection'
import { searchClause } from '../../../lib/search'
import { scoped } from '../../../lib/workspace'
import { findAll as findCategories } from '../../categories/categories.repository'
import { findAll as findItems } from '../../items/items.repository'
import { type Row, type SheetDef, col } from './sheet'
import { ITEM_COLUMNS, itemRow } from './item.rows'

export const categoriesSheet: SheetDef = {
  key: 'categories',
  columns: [col('name', 'text', 28), col('items_count', 'number', 14), col('total_quantity', 'number', 14), col('stock_value', 'money')],
  rows: ({ search }) => {
    const { where, params } = scoped('c.workspace_id', searchClause(['c.name'], search))
    return queryAll<Row>(
      `SELECT c.name, COUNT(DISTINCT i.id) AS items_count, COALESCE(SUM(s.quantity), 0) AS total_quantity,
              COALESCE(SUM(s.quantity * s.purchase_price), 0) AS stock_value
       FROM categories c
       LEFT JOIN items i ON i.category_id = c.id AND i.deleted_at IS NULL
       LEFT JOIN item_stock s ON s.item_id = i.id
       ${where} GROUP BY c.id ORDER BY c.name`,
      params
    )
  }
}

export const categoryItemsSheet: SheetDef = {
  key: 'category_items',
  columns: ITEM_COLUMNS,
  rows: ({ search }) => findCategories({ search }).flatMap((c) => findItems({ category_id: c.id }).map(itemRow))
}
