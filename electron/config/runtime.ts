import { app } from 'electron'

/**
 * وضع التطوير (npm run dev / preview): أي تشغيل مش من النسخة المتسطّبة.
 * بيشتغل على فولدر بيانات منفصل علشان ميلمسش بيانات البرودكشن (شوف main.ts).
 */
export const IS_DEV = !app.isPackaged

/** argument بيتبعت للواجهة (عن طريق الـ preload) علشان تعرف إنها في وضع التطوير */
export const DEV_ARG = '--perfume-dev'
