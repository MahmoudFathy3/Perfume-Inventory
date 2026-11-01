/** لازم يطابق MIN_PASSWORD_LENGTH في electron/security/vault.ts (الـ backend هو اللي بيفرض الحد فعلًا) */
export const MIN_PASSWORD_LENGTH = 8

/** خيارات القفل التلقائي بالدقايق */
export const IDLE_OPTIONS = [1, 2, 5, 10, 15, 30, 60] as const
