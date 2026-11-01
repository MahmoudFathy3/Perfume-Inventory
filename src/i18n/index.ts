import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import ar from './locales/ar.json'
import en from './locales/en.json'
import { DEFAULT_LANGUAGE, getLanguage } from './languages'

void i18n.use(initReactI18next).init({
  resources: { ar: { translation: ar }, en: { translation: en } },
  lng: DEFAULT_LANGUAGE,
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: { escapeValue: false }
})

const LANGUAGE_KEY = 'language'

/** اللغة المحفوظة على الجهاز (للشاشات اللي قبل فتح الداتا بيز) */
export function savedLanguage(): string {
  try {
    return localStorage.getItem(LANGUAGE_KEY) ?? DEFAULT_LANGUAGE
  } catch {
    return DEFAULT_LANGUAGE
  }
}

/** تغيير اللغة + اتجاه الصفحة (rtl / ltr) */
export function applyLanguage(code: string): void {
  const lang = getLanguage(code)
  try {
    localStorage.setItem(LANGUAGE_KEY, lang.code) // شاشة القفل بتحتاج اللغة قبل ما الإعدادات (جوه الداتا بيز) تتفتح
  } catch {
    /* التخزين غير متاح: هنكمل بالافتراضي */
  }
  void i18n.changeLanguage(lang.code)
  document.documentElement.lang = lang.code
  document.documentElement.dir = lang.dir
}

export default i18n
