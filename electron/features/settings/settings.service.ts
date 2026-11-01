import type { SettingKey, SettingsMap } from '@shared/types'
import { execute, queryAll, queryOne } from '../../database/connection'

export const SETTING_KEYS: readonly SettingKey[] = ['language', 'shop_name', 'shop_phone', 'shop_address']

export function get({ key }: { key: SettingKey }): string | null {
  return queryOne<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key])?.value ?? null
}

export function set({ key, value }: { key: SettingKey; value: string }): void {
  if (!SETTING_KEYS.includes(key)) throw new Error('INVALID_SETTING')
  execute('INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, String(value)])
}

/** كل الإعدادات مرة واحدة (اللغة وبيانات المحل) */
export function getAll(): SettingsMap {
  const rows = queryAll<{ key: SettingKey; value: string }>('SELECT key, value FROM settings')
  return Object.fromEntries(rows.filter((r) => SETTING_KEYS.includes(r.key)).map((r) => [r.key, r.value]))
}
