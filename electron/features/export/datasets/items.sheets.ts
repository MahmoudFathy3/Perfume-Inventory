import { findAll as findItems } from '../../items/items.repository'
import { type SheetDef, col } from './sheet'
import { ITEM_COLUMNS, itemRow, MOVEMENT_COLUMNS, movementRows } from './item.rows'

export const itemsSheet: SheetDef = {
  key: 'items',
  columns: ITEM_COLUMNS,
  rows: ({ search }) => findItems({ search }).map(itemRow)
}

export const itemMovementsSheet: SheetDef = {
  key: 'item_movements',
  columns: [col('name_ar', 'text', 24), col('name_en', 'text', 24), ...MOVEMENT_COLUMNS],
  rows: ({ search }) =>
    findItems({ search }).flatMap((i) => movementRows(i.id).map((m) => ({ name_ar: i.name_ar, name_en: i.name_en, ...m })))
}
