import path from 'node:path'
import type { HandleFn } from '../../lib/ipc'
import type { IpcContext } from '../../lib/context'
import { moveDatabase } from '../backup/backup.service'
import type { SettingKey } from '@shared/types'
import { AppError } from '../../lib/errors'
import * as s from './settings.service'

export function register(handle: HandleFn, { dialog, app, config, session }: IpcContext): void {
  handle('settings:get', s.get)
  // صاحب المخزون الفعلي بيتغيّر من workspaces:setOwner بس (علشان اسمه يتغيّر في الشراكات كمان)
  handle('settings:set', (p: { key: SettingKey; value: string }) => {
    if (p.key === 'owner_name') throw new AppError('INVALID_SETTING')
    s.set(p)
  })
  handle('settings:all', s.getAll)
  handle('settings:getDbPath', () => config.read().dbPath)

  handle('settings:changeDbPath', async () => {
    const res = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] })
    if (res.canceled) return { changed: false }
    const current = config.read().dbPath
    const next = path.join(res.filePaths[0], path.basename(current))
    if (next === current) return { changed: false }
    moveDatabase(current, next, session.dbKey())
    config.write({ dbPath: next })
    app.relaunch()
    app.exit(0)
    return { changed: true }
  })
}
