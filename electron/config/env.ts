import path from 'node:path'

// بتتحقن وقت الـ build من ملف .env (لو مش موجودة بنستخدم القيم الافتراضية)
const raw: ImportMetaEnv = import.meta.env ?? {}

function text(value: string | undefined, fallback: string): string {
  return value?.trim() || fallback
}

function positiveInt(value: string | undefined, fallback: number): number {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : fallback
}

/** إعدادات الـ backend من ملف .env (شوف .env.example) */
export const ENV = {
  /** اسم ملف الداتا بيز (اسم ملف بس، من غير مسار) */
  dbFileName: path.basename(text(raw.MAIN_VITE_DB_FILE_NAME, 'perfume-inventory.sqlite')),
  appName: text(raw.MAIN_VITE_APP_NAME, 'Perfume Inventory'),
  appNameAr: text(raw.MAIN_VITE_APP_NAME_AR, 'مخزن العطور'),
  /** مدة الـ Splash بالميلي ثانية */
  splashDurationMs: positiveInt(raw.MAIN_VITE_SPLASH_DURATION_MS, 3000)
} as const
