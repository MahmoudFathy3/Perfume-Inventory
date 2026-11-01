import type { SettingsMap } from '@shared/types'
import { invoke } from '../../api/ipc'
import { useQuery } from '../../hooks/useQuery'
import type { ShopInfo } from './invoice.types'

/** بيانات المحل (الاسم / الهاتف / العنوان) من الإعدادات */
export function useShopInfo(): ShopInfo {
  const { data } = useQuery(() => invoke<SettingsMap>('settings:all'), [])
  return data ?? {}
}
