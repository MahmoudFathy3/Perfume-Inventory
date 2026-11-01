import type { AuthStatus, AuthState } from '@shared/types'
import { AppError } from '../lib/errors'
import { createVault, DEFAULT_IDLE_MINUTES, MIN_PASSWORD_LENGTH, openWithPassword, openWithRecoveryKey, toDbKey, withNewRecoveryKey, withPassword } from './vault'
import type { Vault } from './vault'
import type { VaultStore } from './vaultStore'

export interface SessionOptions {
  store: VaultStore
  /** بتفتح الداتا بيز المشفّرة بالمفتاح (وبتشغّل الـ migrations) */
  openDatabase: (key: string) => void
  closeDatabase: () => void
  now?: () => number
}

export const MIN_IDLE_MINUTES = 1
export const MAX_IDLE_MINUTES = 120
const FREE_ATTEMPTS = 5 // بعد المحاولات دي بيبدأ انتظار بيتضاعف (1، 2، 4... لحد 60 ثانية)
const MAX_WAIT_SECONDS = 60

const checkPassword = (password: unknown): string => {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) throw new AppError('WEAK_PASSWORD')
  return password
}

/**
 * جلسة التطبيق: مين مسموح له يشوف الداتا؟
 * - المفتاح موجود في الذاكرة طول ما التطبيق مفتوح بس، والقفل بيقفل الداتا بيز وبيمسح المفتاح.
 * - القفل التلقائي بعد الخمول بيتحسب هنا (في الـ main) علشان الواجهة متقدرش تتجاهله.
 */
export class Session {
  private vault: Vault | null
  private masterKey: Buffer | null = null
  private failures = 0
  private blockedUntil = 0
  private idleTimer: NodeJS.Timeout | null = null
  private readonly lockListeners = new Set<() => void>()
  private readonly unlockListeners = new Set<() => void>()
  private readonly now: () => number

  constructor(private readonly options: SessionOptions) {
    this.vault = options.store.exists() ? options.store.read() : null
    this.now = options.now ?? Date.now
  }

  // ---------- الحالة ----------
  state(): AuthState {
    if (!this.vault) return 'setup'
    return this.masterKey ? 'unlocked' : 'locked'
  }

  status(): AuthStatus {
    return { state: this.state(), waitSeconds: this.waitSeconds(), idleMinutes: this.vault?.idleMinutes ?? DEFAULT_IDLE_MINUTES }
  }

  /** مفتاح الداتا بيز الحالي (للعمليات اللي بتفتح الداتا بيز تاني زي الاستيراد) */
  dbKey(): string {
    if (!this.masterKey) throw new AppError('LOCKED')
    return toDbKey(this.masterKey)
  }

  /** بيتنادى لما الجلسة تتقفل (يدويًا أو بالخمول) علشان الواجهة تتقفل معاها */
  onLock(listener: () => void): () => void {
    this.lockListeners.add(listener)
    return () => this.lockListeners.delete(listener)
  }

  /** بيتنادى بعد ما الداتا بيز تتفتح (زي النسخ التلقائي). خطأ في الـ listener مبيوقفش الفتح. */
  onUnlock(listener: () => void): () => void {
    this.unlockListeners.add(listener)
    return () => this.unlockListeners.delete(listener)
  }

  // ---------- أول تشغيل / فتح / قفل ----------
  /** أول مرة: بيعمل الخزنة وبيشفّر الداتا بيز. بيرجّع مفتاح الاسترجاع (بيظهر مرة واحدة بس). */
  setup(password: string): string {
    if (this.vault) throw new AppError('ALREADY_SETUP')
    const { vault, masterKey, recoveryKey } = createVault(checkPassword(password))
    this.options.store.write(vault) // الأول الخزنة: لو حصل خطأ بعدها الفتح الجاي بيكمل التشفير
    this.vault = vault
    this.unlockWith(masterKey)
    return recoveryKey
  }

  /**
   * استرجاع على جهاز جديد (لسه مفيش كلمة سر): خزنة النسخة الاحتياطية + كلمتها.
   * install(dbKey) بتحط ملف الداتا بيز مكانه وتتأكد إنه بيتفتح بالمفتاح، وبترمي خطأ لو لأ.
   */
  restore(vault: Vault, password: string, install: (dbKey: string) => void): void {
    if (this.vault) throw new AppError('ALREADY_SETUP')
    this.assertNotBlocked()
    const key = typeof password === 'string' ? openWithPassword(vault, password) : null
    if (!key) return this.fail('WRONG_PASSWORD')
    this.failures = 0
    install(toDbKey(key))
    this.save(vault)
    this.unlockWith(key)
  }

  /** نسخة من الخزنة جنب النسخة الاحتياطية (من غيرها النسخة مبتتفتحش على جهاز تاني) */
  exportVault(destination: string): void {
    this.requireUnlocked()
    this.options.store.copyTo(destination)
  }

  unlock(password: string): void {
    const vault = this.requireVault()
    this.assertNotBlocked()
    const key = typeof password === 'string' ? openWithPassword(vault, password) : null
    if (!key) return this.fail('WRONG_PASSWORD')
    this.failures = 0
    this.unlockWith(key)
  }

  /** نسيت كلمة السر: مفتاح الاسترجاع + كلمة سر جديدة. بيرجّع مفتاح استرجاع جديد (القديم بيبطل). */
  recover(recoveryKey: string, newPassword: string): string {
    const vault = this.requireVault()
    checkPassword(newPassword)
    this.assertNotBlocked()
    const key = typeof recoveryKey === 'string' ? openWithRecoveryKey(vault, recoveryKey) : null
    if (!key) return this.fail('INVALID_RECOVERY_KEY')
    this.failures = 0

    const rotated = withNewRecoveryKey(withPassword(vault, key, newPassword), key)
    this.save(rotated.vault)
    this.unlockWith(key)
    return rotated.recoveryKey
  }

  lock(): void {
    if (!this.masterKey) return
    this.options.closeDatabase()
    this.masterKey.fill(0)
    this.masterKey = null
    this.clearIdleTimer()
    for (const listener of this.lockListeners) listener()
  }

  // ---------- وهو مفتوح ----------
  changePassword(current: string, next: string): void {
    const key = this.verifyCurrent(current)
    checkPassword(next)
    this.save(withPassword(this.vault!, key, next))
  }

  /** مفتاح استرجاع جديد (يطلب كلمة السر الحالية) */
  newRecoveryKey(current: string): string {
    const key = this.verifyCurrent(current)
    const rotated = withNewRecoveryKey(this.vault!, key)
    this.save(rotated.vault)
    return rotated.recoveryKey
  }

  /** تأكيد كلمة السر قبل عملية حساسة (زي قفل أو فتح شراكة). بترمي WRONG_PASSWORD لو غلط. */
  confirmPassword(current: string): void {
    this.verifyCurrent(current).fill(0)
  }

  setIdleMinutes(minutes: number): void {
    this.requireUnlocked()
    const value = Number(minutes)
    if (!Number.isInteger(value) || value < MIN_IDLE_MINUTES || value > MAX_IDLE_MINUTES) throw new AppError('INVALID_IDLE')
    this.save({ ...this.vault!, idleMinutes: value })
    this.touch()
  }

  /** المستخدم لسه شغال: بنأجّل القفل التلقائي */
  touch(): void {
    if (!this.masterKey) return
    this.clearIdleTimer()
    this.idleTimer = setTimeout(() => this.lock(), this.vault!.idleMinutes * 60_000)
    this.idleTimer.unref?.()
  }

  // ---------- داخلي ----------
  private unlockWith(key: Buffer): void {
    try {
      this.options.openDatabase(toDbKey(key))
    } catch (e) {
      key.fill(0)
      throw e
    }
    this.masterKey = key
    this.touch()
    for (const listener of this.unlockListeners) {
      try {
        listener()
      } catch {
        // مبنوقفش الفتح علشان حاجة جانبية فشلت
      }
    }
  }

  private requireVault(): Vault {
    if (!this.vault) throw new AppError('NOT_SETUP')
    return this.vault
  }

  private requireUnlocked(): void {
    if (!this.masterKey) throw new AppError('LOCKED')
  }

  /** نتأكد من كلمة السر الحالية قبل العمليات الحساسة (وبتتحسب في عدّاد المحاولات الغلط) */
  private verifyCurrent(current: string): Buffer {
    this.requireUnlocked()
    this.assertNotBlocked()
    const key = typeof current === 'string' ? openWithPassword(this.vault!, current) : null
    if (!key) return this.fail('WRONG_PASSWORD')
    this.failures = 0
    return key
  }

  private save(vault: Vault): void {
    this.options.store.write(vault)
    this.vault = vault
  }

  private clearIdleTimer(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer)
    this.idleTimer = null
  }

  private waitSeconds(): number {
    return Math.max(0, Math.ceil((this.blockedUntil - this.now()) / 1000))
  }

  private assertNotBlocked(): void {
    if (this.waitSeconds() > 0) throw new AppError('TOO_MANY_ATTEMPTS')
  }

  private fail(code: string): never {
    this.failures++
    if (this.failures >= FREE_ATTEMPTS) {
      const seconds = Math.min(MAX_WAIT_SECONDS, 2 ** (this.failures - FREE_ATTEMPTS))
      this.blockedUntil = this.now() + seconds * 1000
    }
    throw new AppError(code)
  }
}
