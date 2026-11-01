import fs from 'node:fs'
import path from 'node:path'
import type { Vault } from './vault'

export interface VaultStore {
  file: string
  exists: () => boolean
  read: () => Vault
  write: (vault: Vault) => void
  copyTo: (destination: string) => void
}

/** vault.json: ملف صغير جنب الداتا بيز (في فولدر بيانات التطبيق). الكتابة بتتم في ملف مؤقت وبعدين rename علشان مايتبوّزش لو الجهاز قفل في النص. */
/** فحص شكل ملف خزنة جاي من برا (نسخة احتياطية) */
export function parseVault(text: string): Vault {
  const v = JSON.parse(text) as Partial<Vault>
  const wrapped = (w: unknown) => !!w && ['salt', 'iv', 'tag', 'data'].every((k) => typeof (w as Record<string, unknown>)[k] === 'string')
  if (v.version !== 1 || !wrapped(v.password) || !wrapped(v.recovery) || typeof v.idleMinutes !== 'number') throw new Error('INVALID_VAULT')
  return v as Vault
}

export function createVaultStore(file: string): VaultStore {
  return {
    file,
    exists: () => fs.existsSync(file),
    read: () => JSON.parse(fs.readFileSync(file, 'utf8')) as Vault,
    copyTo: (destination) => fs.copyFileSync(file, destination),
    write(vault) {
      fs.mkdirSync(path.dirname(file), { recursive: true })
      const tmp = `${file}.tmp`
      fs.writeFileSync(tmp, JSON.stringify(vault, null, 2), { mode: 0o600 })
      fs.renameSync(tmp, file)
    }
  }
}
