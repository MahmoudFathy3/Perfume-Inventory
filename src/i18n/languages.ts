import type { LanguageCode } from '@shared/types'
import { ENV } from '../config/env'

export interface LanguageInfo {
  code: LanguageCode
  label: string
  dir: 'rtl' | 'ltr'
  /** بتظهر في الإعدادات بس مينفعش تتختار */
  disabled?: boolean
}

// لإضافة لغة: أضف سطر هنا + ملف locales/xx.json + سطر في i18n/index.ts
export const LANGUAGES: LanguageInfo[] = [
  { code: 'ar', label: 'العربية', dir: 'rtl' },
  { code: 'en', label: 'English', dir: 'ltr', disabled: true } // مقفولة مؤقتًا
]

export const DEFAULT_LANGUAGE: LanguageCode = ENV.defaultLanguage
export const getLanguage = (code: string): LanguageInfo => LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0]
