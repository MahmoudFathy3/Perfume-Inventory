import type { AuthStatus } from '@shared/types'
import { invoke } from '@/shared/api/ipc'

export const authApi = {
  status: () => invoke<AuthStatus>('auth:status'),
  /** أول إعداد: بيرجّع مفتاح الاسترجاع (بيظهر مرة واحدة) */
  setup: (p: { password: string }) => invoke<{ recoveryKey: string }>('auth:setup', p),
  unlock: (p: { password: string }) => invoke<void>('auth:unlock', p),
  /** نسيت كلمة السر: بيرجّع مفتاح استرجاع جديد */
  recover: (p: { recoveryKey: string; password: string }) => invoke<{ recoveryKey: string }>('auth:recover', p),
  /** جهاز جديد: بيفتح اختيار النسخة الاحتياطية ويسترجعها بكلمة سرها */
  restore: (p: { password: string }) => invoke<{ done: boolean }>('auth:restore', p),
  lock: () => invoke<void>('auth:lock'),
  ping: () => invoke<void>('auth:ping'),
  changePassword: (p: { current: string; next: string }) => invoke<void>('auth:change-password', p),
  newRecoveryKey: (p: { password: string }) => invoke<{ recoveryKey: string }>('auth:new-recovery-key', p),
  setIdle: (p: { minutes: number }) => invoke<void>('auth:set-idle', p)
}
