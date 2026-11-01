import path from 'node:path'
import type { HandleFn } from '../../lib/ipc'
import type { IpcContext } from '../../lib/context'
import { moveDatabase } from '../backup/backup.service'
import * as s from './settings.service'

export function register(handle: HandleFn, { dialog, app, config, session }: IpcContext): void {
  handle('settings:get', s.get)
  handle('settings:set', s.set)
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
