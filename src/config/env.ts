import type { LanguageCode } from '@shared/types'

/** import.meta.env بيتحقن من Vite؛ في اختبارات Node مش موجود فبنرجع للقيم الافتراضية */
const raw = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {}

/** إعدادات الواجهة من ملف .env (شوف .env.example) */
export const ENV = {
  /** وضع التطوير: الـ main بيشتغل على داتا بيز منفصلة، والواجهة بتعرض علامة DEV */
  isDev: (globalThis as { api?: { isDev?: boolean } }).api?.isDev === true,
  /** كود عملة العرض (ISO) */
  currency: raw.RENDERER_VITE_CURRENCY?.trim() || 'EGP',
  /** لغة أول تشغيل (قبل ما المستخدم يختار من الإعدادات) */
  /** بيانات المطوّر (شاشة "عن المطوّر" في الإعدادات). الفاضي بيتخفي. */
  developer: {
    name: raw.RENDERER_VITE_DEVELOPER_NAME?.trim() || 'Mahmoud Fathy',
    phone: raw.RENDERER_VITE_DEVELOPER_PHONE?.trim() || '',
    email: raw.RENDERER_VITE_DEVELOPER_EMAIL?.trim() || ''
  },
  defaultLanguage: (raw.RENDERER_VITE_DEFAULT_LANGUAGE === 'en' ? 'en' : 'ar') as LanguageCode
} as const
