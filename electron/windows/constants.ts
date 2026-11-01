import { ENV } from '../config/env'

/** إعدادات الويندوز (القيم القابلة للتغيير في ملف .env) */
export const APP_NAME = ENV.appName
export const APP_NAME_AR = ENV.appNameAr

/** معرّف التطبيق في ويندوز (لازم يطابق appId في electron-builder.yml) */
export const APP_ID = 'com.perfume.inventory'

/** مدة ظهور شاشة البداية (Splash) بالميلي ثانية: 3000 = 3 ثواني */
export const SPLASH_DURATION_MS = ENV.splashDurationMs

export const SPLASH_WINDOW = { width: 520, height: 340 } as const
export const MAIN_WINDOW = { width: 1280, height: 800, minWidth: 1000, minHeight: 640 } as const
