import type { WarehouseItem } from '@shared/types'
import { formatMoney } from '@/shared/utils/format'

/** مبالغ المخزن الخارجي بالريال */
export const WAREHOUSE_CURRENCY = 'SAR'
export const formatSar = (value: number, lang: string) => formatMoney(value, lang, WAREHOUSE_CURRENCY)

type Costs = Pick<WarehouseItem, 'unit_price' | 'shipping' | 'customs'>

/** تكلفة القطعة = السعر + الشحن + الجمارك */
export const unitCost = (i: Costs): number => i.unit_price + i.shipping + i.customs
/** إجمالي المنتج = الكمية × تكلفة القطعة */
export const totalCost = (i: Costs & { quantity: number }): number => i.quantity * unitCost(i)
