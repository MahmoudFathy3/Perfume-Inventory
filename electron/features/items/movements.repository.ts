import type { Movement } from '@shared/types'
import { queryAll } from '../../database/connection'

type MovementRow = Omit<Movement, 'total'>

/**
 * كل الحركات اللي اتعملت على المنتج: شراء / بيع / مرتجع بيع / مرتجع شراء / تحويل داخل / تحويل خارج.
 * unit_cost = تكلفة القطعة (بيستخدمها حساب الربح).
 */
export const findMovements = (itemId: number) =>
  queryAll<MovementRow>(
    `SELECT 'purchase' AS type, p.id AS ref_id, p.purchase_date AS date, p.supplier_name AS party, pi.condition,
            pi.quantity, pi.purchase_price AS unit_price, pi.landed_cost AS unit_cost, 1 AS direction
     FROM purchase_items pi JOIN purchases p ON p.id = pi.purchase_id WHERE pi.item_id = @id
     UNION ALL
     SELECT 'sale', s.id, s.sale_date, cu.name, si.condition,
            si.quantity, si.selling_price, si.purchase_price, -1
     FROM sale_items si JOIN sales s ON s.id = si.sale_id LEFT JOIN customers cu ON cu.id = s.customer_id WHERE si.item_id = @id
     UNION ALL
     SELECT 'sale_return', r.id, r.return_date, cu.name, ri.condition,
            ri.quantity, ri.unit_price,
            COALESCE((SELECT SUM(si.quantity * si.purchase_price) * 1.0 / SUM(si.quantity)
                      FROM sale_items si WHERE si.sale_id = r.sale_id AND si.item_id = ri.item_id), 0), 1
     FROM return_items ri JOIN returns r ON r.id = ri.return_id AND r.type = 'sale'
     LEFT JOIN sales s ON s.id = r.sale_id LEFT JOIN customers cu ON cu.id = s.customer_id WHERE ri.item_id = @id
     UNION ALL
     SELECT 'purchase_return', r.id, r.return_date, p.supplier_name, ri.condition,
            ri.quantity, ri.unit_price,
            COALESCE((SELECT SUM(pi.quantity * pi.landed_cost) * 1.0 / SUM(pi.quantity)
                      FROM purchase_items pi WHERE pi.purchase_id = r.purchase_id AND pi.item_id = ri.item_id), 0), -1
     FROM return_items ri JOIN returns r ON r.id = ri.return_id AND r.type = 'purchase'
     LEFT JOIN purchases p ON p.id = r.purchase_id WHERE ri.item_id = @id
     UNION ALL
     SELECT 'transfer_out', t.id, t.transfer_date, NULL, ti.condition, ti.quantity, ti.unit_price, ti.unit_cost, -1
     FROM transfer_items ti JOIN transfers t ON t.id = ti.transfer_id WHERE ti.from_item_id = @id
     UNION ALL
     SELECT 'transfer_in', t.id, t.transfer_date, NULL, ti.condition, ti.quantity, ti.unit_price, ti.unit_price, 1
     FROM transfer_items ti JOIN transfers t ON t.id = ti.transfer_id WHERE ti.to_item_id = @id
     ORDER BY date DESC, ref_id DESC`,
    { id: itemId }
  )
