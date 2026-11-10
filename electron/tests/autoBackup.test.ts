import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import type { AppConfig, ConfigData } from '../config/appConfig'
import { AUTO_BACKUP_INTERVAL_MS, autoBackupStatus, runAutoBackup, updateAutoBackup } from '../features/backup/autoBackup.service'
import type { AutoBackupDeps } from '../features/backup/autoBackup.service'
import { listTransfers } from '../features/backup/backup.service'
import { err, useTestDb } from './helpers'

const { dbFile } = useTestDb()
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-'))
test.after(() => fs.rmSync(tmp, { recursive: true, force: true }))

/** config في الذاكرة بنفس شكل config.json */
function memoryConfig(initial: Partial<ConfigData> = {}): AppConfig {
  let data: ConfigData = { dbPath: dbFile, autoBackupEnabled: true, autoBackupDir: '', autoBackupKeep: 30, appName: '', ...initial }
  return { read: () => ({ ...data }), write: (patch) => void (data = { ...data, ...patch }) }
}

function deps(name: string, config = memoryConfig(), now = () => Date.now()): AutoBackupDeps & { vaults: string[] } {
  const vaults: string[] = []
  return {
    config,
    defaultDir: path.join(tmp, name),
    exportVault: (to) => {
      vaults.push(to)
      fs.writeFileSync(to, '{}')
    },
    now,
    vaults
  }
}

const backups = (dir: string) => fs.readdirSync(dir).filter((f) => f.endsWith('.sqlite')).sort()

test('النسخة التلقائية: أول مرة بتتعمل في الفولدر الافتراضي ومعاها الخزنة، وبتتسجل في السجل', () => {
  const d = deps('first')
  const file = runAutoBackup(d)
  assert.ok(file && fs.existsSync(file))
  assert.equal(path.dirname(file), d.defaultDir)
  assert.deepEqual(d.vaults, [`${file}.vault.json`])
  assert.ok(fs.existsSync(`${file}.vault.json`))
  assert.equal(listTransfers()[0].status, 'auto')

  const status = autoBackupStatus(d)
  assert.equal(status.count, 1)
  assert.equal(status.isDefaultDir, true)
  assert.ok(status.lastAt)
})

test('مبتتكررش قبل ما يعدّي يوم، وبعد يوم بتتعمل تاني، وforce بيعملها في أي وقت', () => {
  let now = Date.now()
  const d = deps('daily', memoryConfig(), () => now)
  assert.ok(runAutoBackup(d))
  now += AUTO_BACKUP_INTERVAL_MS - 60_000
  assert.equal(runAutoBackup(d), null) // لسه ماعدّاش يوم
  now += 120_000
  // الاسم بالثانية: نستنى ثانية علشان النسخة التانية ليها اسم مختلف
  const until = Date.now() + 1100
  while (Date.now() < until) { /* انتظار */ }
  assert.ok(runAutoBackup(d))
  assert.equal(backups(d.defaultDir).length, 2)
  assert.ok(runAutoBackup(d, { force: true }) !== null)
})

test('لما تتقفل مبتتعملش تلقائي، بس "انسخ دلوقتي" بتشتغل', () => {
  const d = deps('disabled', memoryConfig({ autoBackupEnabled: false }))
  assert.equal(runAutoBackup(d), null)
  assert.ok(!fs.existsSync(d.defaultDir))
  assert.ok(runAutoBackup(d, { force: true }))
})

test('بتحتفظ بآخر keep نسخة بس، والأقدم بيتمسح هو وخزنته', () => {
  const config = memoryConfig({ autoBackupKeep: 7 })
  const d = deps('prune', config)
  fs.mkdirSync(d.defaultDir, { recursive: true })
  for (let day = 1; day <= 9; day++) {
    const name = path.join(d.defaultDir, `auto-backup-2020-01-0${day}-10-00-00.sqlite`)
    fs.writeFileSync(name, 'x')
    fs.writeFileSync(`${name}.vault.json`, '{}')
  }
  fs.writeFileSync(path.join(d.defaultDir, 'my-own-file.sqlite'), 'x') // ملفات المستخدم التانية مبتتلمسش

  runAutoBackup(d, { force: true })
  const left = backups(d.defaultDir).filter((f) => f.startsWith('auto-backup-'))
  assert.equal(left.length, 7)
  assert.ok(!left.includes('auto-backup-2020-01-01-10-00-00.sqlite'))
  assert.ok(!left.includes('auto-backup-2020-01-03-10-00-00.sqlite'))
  assert.ok(left.includes('auto-backup-2020-01-04-10-00-00.sqlite'))
  assert.ok(!fs.existsSync(path.join(d.defaultDir, 'auto-backup-2020-01-01-10-00-00.sqlite.vault.json')))
  assert.ok(fs.existsSync(path.join(d.defaultDir, 'my-own-file.sqlite')))
})

test('فولدر اختاره المستخدم، والرجوع للافتراضي، وعدد نسخ غير مسموح بيترفض', () => {
  const config = memoryConfig()
  const d = deps('custom-default', config)
  const custom = path.join(tmp, 'usb', 'backups')
  updateAutoBackup(config, { dir: custom })
  assert.equal(autoBackupStatus(d).dir, custom)
  assert.equal(autoBackupStatus(d).isDefaultDir, false)
  assert.ok(runAutoBackup(d, { force: true })!.startsWith(custom))

  updateAutoBackup(config, { dir: '' })
  assert.equal(autoBackupStatus(d).dir, d.defaultDir)
  assert.equal(err(() => updateAutoBackup(config, { keep: 3 })), 'INVALID_NUMBER')
  updateAutoBackup(config, { keep: 60, enabled: false })
  assert.deepEqual([config.read().autoBackupKeep, config.read().autoBackupEnabled], [60, false])
})

test('لو الفولدر مش متاح: الفشل بيتسجل ومفيش نسخة ناقصة', () => {
  const blocker = path.join(tmp, 'not-a-folder')
  fs.writeFileSync(blocker, 'x') // ملف مكان الفولدر = مينفعش نعمل الفولدر
  const d = deps('broken', memoryConfig({ autoBackupDir: path.join(blocker, 'inside') }))
  assert.equal(err(() => runAutoBackup(d)), 'AUTO_BACKUP_FAILED')
  assert.equal(listTransfers()[0].status, 'auto-failed')
})
