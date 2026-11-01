import crypto from 'node:crypto'

/**
 * الخزنة (vault): بتحمي مفتاح تشفير الداتا بيز (master key).
 * - الداتا بيز مشفّرة بمفتاح عشوائي 256 بت (مش بكلمة السر نفسها).
 * - المفتاح ده متخزن مرتين مغلّف (AES-256-GCM): مرة بمفتاح مشتق من كلمة السر، ومرة بمفتاح مشتق من مفتاح الاسترجاع.
 * - لذلك تغيير كلمة السر = إعادة تغليف المفتاح بس (من غير إعادة تشفير الداتا بيز)، ومفتاح الاسترجاع بيفتح نفس المفتاح لو نسيت كلمة السر.
 * - الاشتقاق بـ scrypt (بطيء عن قصد علشان يصعّب التخمين).
 */

export interface Wrapped {
  salt: string
  iv: string
  tag: string
  data: string
}

export interface Vault {
  version: 1
  password: Wrapped
  recovery: Wrapped
  /** دقايق الخمول قبل القفل التلقائي */
  idleMinutes: number
}

export const MIN_PASSWORD_LENGTH = 8
export const DEFAULT_IDLE_MINUTES = 10

const SCRYPT = { N: 1 << 15, r: 8, p: 1, maxmem: 128 * 1024 * 1024 }
const AAD = Buffer.from('perfume-inventory-vault-v1')
// حروف مفتاح الاسترجاع: من غير 0/O و1/I علشان مفيش لبس وقت الكتابة
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // 32 حرف بالظبط (5 بت لكل حرف)

const b64 = (b: Buffer) => b.toString('base64')
const fromB64 = (s: string) => Buffer.from(s, 'base64')

function wrap(secret: string, masterKey: Buffer): Wrapped {
  const salt = crypto.randomBytes(16)
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', crypto.scryptSync(secret, salt, 32, SCRYPT), iv)
  cipher.setAAD(AAD)
  const data = Buffer.concat([cipher.update(masterKey), cipher.final()])
  return { salt: b64(salt), iv: b64(iv), tag: b64(cipher.getAuthTag()), data: b64(data) }
}

/** المفتاح لو السر صح، وإلا null (الـ GCM tag بيفشل مع أي سر غلط) */
function unwrap(w: Wrapped, secret: string): Buffer | null {
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', crypto.scryptSync(secret, fromB64(w.salt), 32, SCRYPT), fromB64(w.iv))
    decipher.setAAD(AAD)
    decipher.setAuthTag(fromB64(w.tag))
    return Buffer.concat([decipher.update(fromB64(w.data)), decipher.final()])
  } catch {
    return null
  }
}

/** مفتاح استرجاع جديد: 160 بت عشوائي، شكله XXXX-XXXX-... (8 مجموعات) */
export function generateRecoveryKey(): string {
  let bits = ''
  for (const byte of crypto.randomBytes(20)) bits += byte.toString(2).padStart(8, '0')
  let out = ''
  for (let i = 0; i < 160; i += 5) out += ALPHABET[parseInt(bits.slice(i, i + 5), 2)]
  return out.match(/.{4}/g)!.join('-')
}

/** بنقبل المفتاح بأي حروف كبيرة/صغيرة ومسافات وشرطات */
export const normalizeRecoveryKey = (key: string): string => key.toUpperCase().replace(/[^A-Z0-9]/g, '')

export interface CreatedVault {
  vault: Vault
  masterKey: Buffer
  recoveryKey: string
}

export function createVault(password: string, idleMinutes = DEFAULT_IDLE_MINUTES): CreatedVault {
  const masterKey = crypto.randomBytes(32)
  const recoveryKey = generateRecoveryKey()
  const vault: Vault = {
    version: 1,
    password: wrap(password, masterKey),
    recovery: wrap(normalizeRecoveryKey(recoveryKey), masterKey),
    idleMinutes
  }
  return { vault, masterKey, recoveryKey }
}

export const openWithPassword = (vault: Vault, password: string): Buffer | null => unwrap(vault.password, password)
export const openWithRecoveryKey = (vault: Vault, recoveryKey: string): Buffer | null => unwrap(vault.recovery, normalizeRecoveryKey(recoveryKey))

/** كلمة سر جديدة لنفس المفتاح */
export const withPassword = (vault: Vault, masterKey: Buffer, password: string): Vault => ({ ...vault, password: wrap(password, masterKey) })

/** مفتاح استرجاع جديد (القديم بيبطل) */
export function withNewRecoveryKey(vault: Vault, masterKey: Buffer): { vault: Vault; recoveryKey: string } {
  const recoveryKey = generateRecoveryKey()
  return { vault: { ...vault, recovery: wrap(normalizeRecoveryKey(recoveryKey), masterKey) }, recoveryKey }
}

export const toDbKey = (masterKey: Buffer): string => masterKey.toString('hex')
