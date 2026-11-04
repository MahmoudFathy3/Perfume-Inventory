import { queryAll } from '../../../database/connection'
import { searchClause } from '../../../lib/search'
import { inWorkspace } from '../../../lib/workspace'
import { storeName } from './stores'
import { type Row, type SheetDef, col } from './sheet'

/** منتجات المخزن الخارجي النشط (بنفس البحث) ومبالغها بالريال */
export const warehouseItemsSheet: SheetDef = {
  key: 'warehouse_items',
  columns: [
    col('name', 'text', 28), col('quantity', 'number', 10), col('unit_price_sar', 'money'), col('shipping_sar', 'money'),
    col('customs_sar', 'money'), col('unit_cost_sar', 'money'), col('total_cost_sar', 'money'), col('notes', 'text', 30)
  ],
  rows: ({ search }) => {
    const { where, params } = searchClause(['name', 'notes'], search, 'AND')
    return queryAll<Row>(
      `SELECT name, quantity, unit_price AS unit_price_sar, shipping AS shipping_sar, customs AS customs_sar,
              unit_price + shipping + customs AS unit_cost_sar, quantity * (unit_price + shipping + customs) AS total_cost_sar, notes
       FROM warehouse_items WHERE ${inWorkspace('warehouse_id')} ${where} ORDER BY name`,
      params
    )
  }
}

/** الشحنات (الأحدث الأول) ومحتواها في عمود واحد */
export const warehouseShipmentsSheet: SheetDef = {
  key: 'warehouse_shipments',
  columns: [
    col('id', 'number', 10), col('ship_date', 'date'), col('destination', 'enum', 24), col('shipment_status', 'enum', 14),
    col('arrived_date', 'date'), col('pieces', 'number', 10), col('contents', 'text', 48), col('notes', 'text', 30)
  ],
  rows: () =>
    queryAll<Row>(
      `SELECT s.id, s.ship_date, ${storeName('s.workspace_id')} AS destination, s.status AS shipment_status, s.arrived_date,
              (SELECT COALESCE(SUM(quantity), 0) FROM warehouse_shipment_items WHERE shipment_id = s.id) AS pieces,
              (SELECT group_concat(i.name || ' × ' || l.quantity, ' | ') FROM warehouse_shipment_items l
               JOIN warehouse_items i ON i.id = l.item_id WHERE l.shipment_id = s.id) AS contents, s.notes
       FROM warehouse_shipments s WHERE ${inWorkspace('s.warehouse_id')} ORDER BY s.ship_date DESC, s.id DESC`
    )
}

/** سطر بكل منتج في كل شحنة */
export const warehouseShipmentItemsSheet: SheetDef = {
  key: 'warehouse_shipment_items',
  columns: [
    col('shipment', 'number', 10), col('ship_date', 'date'), col('destination', 'enum', 24), col('shipment_status', 'enum', 14),
    col('name', 'text', 28), col('quantity', 'number', 10)
  ],
  rows: () =>
    queryAll<Row>(
      `SELECT s.id AS shipment, s.ship_date, ${storeName('s.workspace_id')} AS destination, s.status AS shipment_status, i.name, l.quantity
       FROM warehouse_shipment_items l JOIN warehouse_shipments s ON s.id = l.shipment_id JOIN warehouse_items i ON i.id = l.item_id
       WHERE ${inWorkspace('s.warehouse_id')} ORDER BY s.ship_date DESC, s.id DESC, l.id`
    )
}
