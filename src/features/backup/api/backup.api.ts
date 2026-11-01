import type { AutoBackupStatus, DataTransfer } from '@shared/types'
import { invoke } from '@/shared/api/ipc'

export const backupApi = {
  export: () => invoke<{ done: boolean; filePath?: string }>('backup:export'),
  import: () => invoke<{ done: boolean }>('backup:import'),
  history: () => invoke<DataTransfer[]>('backup:history'),

  // النسخ التلقائي
  autoStatus: () => invoke<AutoBackupStatus>('backup:autoStatus'),
  autoUpdate: (p: { enabled?: boolean; keep?: number }) => invoke<AutoBackupStatus>('backup:autoUpdate', p),
  autoChooseDir: () => invoke<AutoBackupStatus>('backup:autoChooseDir'),
  autoResetDir: () => invoke<AutoBackupStatus>('backup:autoResetDir'),
  autoRunNow: () => invoke<AutoBackupStatus>('backup:autoRunNow')
}
