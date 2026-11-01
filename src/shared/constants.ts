import type { Condition, MovementType, PriceType, ShippingPayer } from '@shared/types'
import { ENV } from '../config/env'

export const CONDITIONS: readonly Condition[] = ['new', 'damaged']
export const PRICE_TYPES: readonly PriceType[] = ['retail', 'wholesale']
export const SHIPPING_PAYERS: readonly ShippingPayer[] = ['customer', 'shop']
export const MOVEMENT_TYPES: readonly MovementType[] = ['purchase', 'sale', 'sale_return', 'purchase_return', 'transfer_in', 'transfer_out']
export const PAGE_SIZES = [10, 25, 50] as const
/** عملة العرض (من ملف .env) */
export const CURRENCY = ENV.currency
