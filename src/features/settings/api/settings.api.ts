import type { SettingKey, SettingsMap } from '@shared/types'
import { invoke } from '@/shared/api/ipc'

export const settingsApi = {
  get: (key: SettingKey) => invoke<string | null>('settings:get', { key }),
  set: (key: SettingKey, value: string) => invoke<void>('settings:set', { key, value }),
  all: () => invoke<SettingsMap>('settings:all'),
  getDbPath: () => invoke<string>('settings:getDbPath'),
  changeDbPath: () => invoke<{ changed: boolean }>('settings:changeDbPath')
}
