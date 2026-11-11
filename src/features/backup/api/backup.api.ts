import type { AutoBackupStatus, DataTransfer } from '@shared/types'
import { invoke } from '@/shared/api/ipc'

export const backupApi = {
  export: () => invoke<{ done: boolean; filePath?: string }>('backup:export'),
  /** foreign = النسخة من جهاز تاني ومحتاجة كلمة سره (importForeign) */
  import: () => invoke<{ done: boolean; foreign?: boolean; hasVault?: boolean }>('backup:import'),
  /** نسخة جهاز تاني: كلمة سره القديمة أو مفتاح استرجاعه */
  importForeign: (p: { secret: string }) => invoke<{ done: boolean }>('backup:import-foreign', p),
  history: () => invoke<DataTransfer[]>('backup:history'),

  // النسخ التلقائي
  autoStatus: () => invoke<AutoBackupStatus>('backup:autoStatus'),
  autoUpdate: (p: { enabled?: boolean; keep?: number }) => invoke<AutoBackupStatus>('backup:autoUpdate', p),
  autoChooseDir: () => invoke<AutoBackupStatus>('backup:autoChooseDir'),
  autoResetDir: () => invoke<AutoBackupStatus>('backup:autoResetDir'),
  autoRunNow: () => invoke<AutoBackupStatus>('backup:autoRunNow')
}
