import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test, { mock } from 'node:test'
import { closeDb, createDatabase, encryptInPlace, getDb, isPlaintextDb, openDb } from '../database/connection'
import { migrate } from '../database/migrate'
import { registerAll } from '../features'
import * as backup from '../features/backup/backup.service'
import { Session } from '../security/session'
import {
  createVault, generateRecoveryKey, openWithPassword, openWithRecoveryKey, toDbKey, withNewRecoveryKey, withPassword
} from '../security/vault'
import { createVaultStore, parseVault } from '../security/vaultStore'
import { err } from './helpers'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sec-'))
test.after(() => {
  closeDb()
  fs.rmSync(tmp, { recursive: true, force: true })
})

const PASSWORD = 'correct horse 1'
const KEY = 'ab'.repeat(32)
const header = (file: string) => fs.readFileSync(file).subarray(0, 15).toString('latin1')
const dir = (name: string) => fs.mkdirSync(path.join(tmp, name), { recursive: true }) ?? path.join(tmp, name)

/** جلسة كاملة على فولدر مؤقت (نفس ربط التطبيق: فتح الداتا بيز بالمفتاح + migrations) */
function makeSession(name: string, now?: () => number) {
  const folder = dir(name)
  const dbPath = path.join(folder, 'inventory.sqlite')
  const store = createVaultStore(path.join(folder, 'vault.json'))
  const session = new Session({
    store,
    openDatabase(key) {
      if (fs.existsSync(dbPath) && isPlaintextDb(dbPath)) encryptInPlace(dbPath, key)
      openDb(dbPath, key)
      migrate(getDb())
    },
    closeDatabase: closeDb,
    now
  })
  return { session, dbPath, store, folder }
}

// ---------- الخزنة ----------
test('الخزنة: كلمة السر ومفتاح الاسترجاع بيفتحوا نفس المفتاح، وأي سر غلط بيترفض', () => {
  const { vault, masterKey, recoveryKey } = createVault(PASSWORD)
  assert.match(recoveryKey, /^([A-HJ-NP-Z2-9]{4}-){7}[A-HJ-NP-Z2-9]{4}$/)
  assert.deepEqual(openWithPassword(vault, PASSWORD), masterKey)
  assert.equal(openWithPassword(vault, PASSWORD + 'x'), null)
  // الحروف الصغيرة والمسافات بدل الشرطات مقبولة
  assert.deepEqual(openWithRecoveryKey(vault, recoveryKey.toLowerCase().replace(/-/g, ' ')), masterKey)
  assert.equal(openWithRecoveryKey(vault, generateRecoveryKey()), null)
  // الملف مفيهوش المفتاح ولا كلمة السر ولا مفتاح الاسترجاع
  const text = JSON.stringify(vault)
  for (const secret of [toDbKey(masterKey), masterKey.toString('base64'), PASSWORD, recoveryKey]) assert.ok(!text.includes(secret))
})

test('الخزنة: تغيير كلمة السر بيحافظ على المفتاح، ومفتاح الاسترجاع الجديد بيبطّل القديم', () => {
  const { vault, masterKey, recoveryKey } = createVault(PASSWORD)
  const changed = withPassword(vault, masterKey, 'another pass 22')
  assert.equal(openWithPassword(changed, PASSWORD), null)
  assert.deepEqual(openWithPassword(changed, 'another pass 22'), masterKey)

  const rotated = withNewRecoveryKey(changed, masterKey)
  assert.equal(openWithRecoveryKey(rotated.vault, recoveryKey), null)
  assert.deepEqual(openWithRecoveryKey(rotated.vault, rotated.recoveryKey), masterKey)
})

// ---------- تشفير الداتا بيز ----------
test('الداتا بيز المشفّرة: الملف مش مقروء، ومفتاح غلط أو من غير مفتاح بيفشل', () => {
  const file = path.join(dir('enc'), 'a.sqlite')
  const db = createDatabase(file, {}, KEY)
  db.exec('CREATE TABLE t(v TEXT); INSERT INTO t VALUES (\'سر-المحل\')')
  db.close()

  assert.ok(!isPlaintextDb(file))
  assert.ok(!fs.readFileSync(file).includes(Buffer.from('سر-المحل')), 'البيانات مش ظاهرة في الملف')
  assert.throws(() => createDatabase(file, {}, 'cd'.repeat(32)))
  const plain = createDatabase(file) // من غير مفتاح: الفتح بينجح بس القراية بتفشل
  try {
    assert.throws(() => plain.prepare('SELECT * FROM t').all())
  } finally {
    plain.close() // من غيرها الملف بيفضل مقفول على ويندوز والتنضيف بيفشل (EBUSY)
  }

  const again = createDatabase(file, {}, KEY)
  assert.deepEqual(again.prepare('SELECT v FROM t').all(), [{ v: 'سر-المحل' }])
  again.close()
})

test('المفتاح لازم يكون 64 hex بس (مفيش حقن في أمر PRAGMA)', () => {
  const file = path.join(dir('enc'), 'b.sqlite')
  for (const bad of ["x'; DROP TABLE t; --", 'zz'.repeat(32), 'ab'.repeat(31)]) {
    assert.throws(() => createDatabase(file, {}, bad), /INVALID_DB_KEY/)
  }
})

test('داتا بيز عادية قديمة بتتشفّر في مكانها وبياناتها بتفضل', () => {
  const file = path.join(dir('enc'), 'legacy.sqlite')
  const plain = createDatabase(file)
  plain.exec("CREATE TABLE t(v TEXT); INSERT INTO t VALUES ('قديم')")
  plain.close()
  assert.ok(isPlaintextDb(file))

  encryptInPlace(file, KEY)
  assert.ok(!isPlaintextDb(file))
  assert.equal(header(file).includes('SQLite format'), false)
  const db = createDatabase(file, {}, KEY)
  assert.deepEqual(db.prepare('SELECT v FROM t').all(), [{ v: 'قديم' }])
  db.close()
})

// ---------- الجلسة ----------
test('أول تشغيل: كلمة سر قصيرة بتترفض، والنجاح بيشفّر الداتا بيز ويرجّع مفتاح الاسترجاع', () => {
  const { session, dbPath, store } = makeSession('s1')
  assert.equal(session.state(), 'setup')
  assert.equal(err(() => session.setup('short')), 'WEAK_PASSWORD')
  assert.equal(session.state(), 'setup')

  const recovery = session.setup(PASSWORD)
  assert.match(recovery, /^([A-Z2-9]{4}-){7}[A-Z2-9]{4}$/)
  assert.equal(session.state(), 'unlocked')
  assert.equal(err(() => session.setup(PASSWORD)), 'ALREADY_SETUP')

  getDb().prepare("INSERT INTO settings(key, value) VALUES ('shop_name', 'عطور')").run()
  closeDb()
  assert.ok(!isPlaintextDb(dbPath))
  assert.ok(!fs.readFileSync(store.file, 'utf8').includes(PASSWORD))
  session.lock()
})

test('القفل بيقفل الداتا بيز، والفتح بيرجّعها، وكلمة السر الغلط بتترفض', () => {
  const { session } = makeSession('s2')
  session.setup(PASSWORD)
  getDb().prepare("INSERT INTO settings(key, value) VALUES ('shop_name', 'عطور')").run()

  let locked = 0
  session.onLock(() => locked++)
  session.lock()
  assert.equal(locked, 1)
  assert.equal(session.state(), 'locked')
  assert.throws(() => getDb(), /DB_NOT_OPEN/)
  assert.equal(err(() => session.dbKey()), 'LOCKED')

  assert.equal(err(() => session.unlock('wrong password')), 'WRONG_PASSWORD')
  assert.equal(session.state(), 'locked')
  session.unlock(PASSWORD)
  assert.equal(session.state(), 'unlocked')
  assert.deepEqual(getDb().prepare('SELECT value FROM settings WHERE key = ?').get('shop_name'), { value: 'عطور' })
  session.lock()
})

test('بعد 5 محاولات غلط الانتظار بيبدأ حتى لو كلمة السر صح، وبيتصفّر بعد النجاح', () => {
  let clock = 1_000_000
  const { session } = makeSession('s3', () => clock)
  session.setup(PASSWORD)
  session.lock()

  for (let i = 0; i < 5; i++) assert.equal(err(() => session.unlock('nope nope nope')), 'WRONG_PASSWORD')
  assert.equal(err(() => session.unlock(PASSWORD)), 'TOO_MANY_ATTEMPTS')
  assert.equal(session.status().waitSeconds, 1)

  clock += 1_500
  assert.equal(err(() => session.unlock('nope nope nope')), 'WRONG_PASSWORD') // المحاولة السادسة: انتظار ثانيتين
  assert.equal(session.status().waitSeconds, 2)
  clock += 2_500
  session.unlock(PASSWORD)
  assert.equal(session.status().waitSeconds, 0)
  session.lock()
  for (let i = 0; i < 4; i++) assert.equal(err(() => session.unlock('nope nope nope')), 'WRONG_PASSWORD') // العدّاد اتصفّر
  session.unlock(PASSWORD)
  session.lock()
})

test('تغيير كلمة السر: بيطلب الحالية، والقديمة بتبطل، وبيفضل يشتغل بعد إعادة التشغيل', () => {
  const { session, store, dbPath } = makeSession('s4')
  session.setup(PASSWORD)
  assert.equal(err(() => session.changePassword('wrong one here', 'new password 99')), 'WRONG_PASSWORD')
  assert.equal(err(() => session.changePassword(PASSWORD, 'short')), 'WEAK_PASSWORD')
  session.changePassword(PASSWORD, 'new password 99')
  session.lock()

  assert.equal(err(() => session.unlock(PASSWORD)), 'WRONG_PASSWORD')
  // "إعادة تشغيل": جلسة جديدة بنفس الملفات
  const restarted = new Session({ store, openDatabase: (key) => { openDb(dbPath, key); migrate(getDb()) }, closeDatabase: closeDb })
  assert.equal(restarted.state(), 'locked')
  restarted.unlock('new password 99')
  assert.equal(restarted.state(), 'unlocked')
  restarted.lock()
})

test('نسيت كلمة السر: مفتاح الاسترجاع بيفتح ويحط كلمة جديدة، وبيطلع مفتاح جديد والقديم بيبطل', () => {
  const { session } = makeSession('s5')
  const first = session.setup(PASSWORD)
  getDb().prepare("INSERT INTO settings(key, value) VALUES ('shop_name', 'عطور')").run()
  session.lock()

  assert.equal(err(() => session.recover(generateRecoveryKey(), 'brand new pass 1')), 'INVALID_RECOVERY_KEY')
  assert.equal(err(() => session.recover(first, 'short')), 'WEAK_PASSWORD')
  const second = session.recover(first.toLowerCase(), 'brand new pass 1')
  assert.notEqual(second, first)
  assert.equal(session.state(), 'unlocked')
  assert.deepEqual(getDb().prepare('SELECT value FROM settings WHERE key = ?').get('shop_name'), { value: 'عطور' })
  session.lock()

  session.unlock('brand new pass 1')
  session.lock()
  assert.equal(err(() => session.recover(first, 'whatever pass 12')), 'INVALID_RECOVERY_KEY')
  assert.ok(session.recover(second, 'last pass here 3'))
  session.lock()
})

test('مفتاح استرجاع جديد بيطلب كلمة السر الحالية', () => {
  const { session } = makeSession('s6')
  const first = session.setup(PASSWORD)
  assert.equal(err(() => session.newRecoveryKey('wrong password!')), 'WRONG_PASSWORD')
  const next = session.newRecoveryKey(PASSWORD)
  session.lock()
  assert.equal(err(() => session.recover(first, 'x password here 1')), 'INVALID_RECOVERY_KEY')
  session.recover(next, 'x password here 1')
  session.lock()
})

test('القفل التلقائي بعد الخمول، والحركة بتأجّله، ومدة الخمول بتتحفظ', () => {
  mock.timers.enable({ apis: ['setTimeout'] })
  try {
    const { session, store } = makeSession('s7')
    session.setup(PASSWORD)
    assert.equal(err(() => session.setIdleMinutes(0)), 'INVALID_IDLE')
    assert.equal(err(() => session.setIdleMinutes(500)), 'INVALID_IDLE')
    session.setIdleMinutes(2)
    assert.equal(store.read().idleMinutes, 2)

    mock.timers.tick(90_000)
    session.touch() // حركة بعد 90 ثانية: العدّاد بيبدأ من جديد
    mock.timers.tick(90_000)
    assert.equal(session.state(), 'unlocked')
    mock.timers.tick(31_000)
    assert.equal(session.state(), 'locked')
    assert.throws(() => getDb(), /DB_NOT_OPEN/)
  } finally {
    mock.timers.reset()
  }
})

test('داتا بيز قديمة عادية موجودة قبل كلمة السر: أول إعداد بيشفّرها وبياناتها بتفضل', () => {
  const folder = dir('s8')
  const dbPath = path.join(folder, 'inventory.sqlite')
  const old = createDatabase(dbPath)
  migrate(old)
  old.exec("INSERT INTO settings VALUES ('shop_name', 'قديم')")
  old.close()

  const { session } = makeSession('s8')
  assert.ok(isPlaintextDb(dbPath))
  session.setup(PASSWORD)
  assert.deepEqual(getDb().prepare('SELECT value FROM settings WHERE key = ?').get('shop_name'), { value: 'قديم' })
  closeDb()
  assert.ok(!isPlaintextDb(dbPath))
  session.lock()
})

// ---------- رفض الأوامر وهو مقفول ----------
test('IPC: كل الأوامر بتترفض LOCKED وهو مقفول ما عدا auth:*', async () => {
  const handlers = new Map<string, (e: unknown, p: unknown) => Promise<{ ok: boolean; error?: string; data?: unknown }>>()
  const { session } = makeSession('s9')
  registerAll({ ipcMain: { handle: (ch: string, fn: never) => handlers.set(ch, fn) }, dialog: {}, app: {}, config: {}, clipboard: {}, session } as never)
  const call = (channel: string, payload?: unknown) => handlers.get(channel)!({}, payload)

  assert.equal((await call('auth:status')).ok, true)
  for (const channel of ['items:list', 'sales:page', 'settings:get', 'backup:history', 'dashboard:summary', 'workspaces:list', 'transfers:page', 'partners:ledger']) {
    assert.deepEqual(await call(channel, {}), { ok: false, error: 'LOCKED' }, channel)
  }

  assert.equal((await call('auth:setup', { password: PASSWORD })).ok, true)
  assert.equal((await call('items:list', {})).ok, true)
  assert.equal((await call('auth:lock')).ok, true)
  assert.deepEqual(await call('items:list', {}), { ok: false, error: 'LOCKED' })
  assert.deepEqual(await call('auth:unlock', { password: 'wrong pass here' }), { ok: false, error: 'WRONG_PASSWORD' })
  closeDb()
})

test('IPC: قفل وفتح وحذف الشراكة بيطلبوا كلمة سر التطبيق', async () => {
  const handlers = new Map<string, (e: unknown, p: unknown) => Promise<{ ok: boolean; error?: string; data?: unknown }>>()
  const { session } = makeSession('s9b')
  registerAll({ ipcMain: { handle: (ch: string, fn: never) => handlers.set(ch, fn) }, dialog: {}, app: {}, config: {}, clipboard: {}, session } as never)
  const call = (channel: string, payload?: unknown) => handlers.get(channel)!({}, payload)
  const closedAt = async (id: number) => ((await call('workspaces:list')).data as { id: number; closed_at: string | null }[]).find((w) => w.id === id)!.closed_at

  session.setup(PASSWORD)
  const { data: id } = (await call('workspaces:create', { partners: ['أحمد', 'محمود'] })) as { data: number }

  for (const password of [undefined, '', 'wrong pass here']) {
    assert.deepEqual(await call('workspaces:close', { id, password }), { ok: false, error: 'WRONG_PASSWORD' })
  }
  assert.equal(await closedAt(id), null)
  assert.equal((await call('workspaces:close', { id, password: PASSWORD })).ok, true)
  assert.notEqual(await closedAt(id), null)

  assert.deepEqual(await call('workspaces:reopen', { id, password: 'wrong pass here' }), { ok: false, error: 'WRONG_PASSWORD' })
  assert.equal((await call('workspaces:reopen', { id, password: PASSWORD })).ok, true)
  assert.equal(await closedAt(id), null)

  const exists = async () => ((await call('workspaces:list')).data as { id: number }[]).some((w) => w.id === id)
  assert.deepEqual(await call('workspaces:remove', { id, password: 'wrong pass here' }), { ok: false, error: 'WRONG_PASSWORD' })
  assert.equal(await exists(), true)
  assert.equal((await call('workspaces:remove', { id, password: PASSWORD })).ok, true)
  assert.equal(await exists(), false)
  session.lock()
})

// ---------- النسخ الاحتياطي ----------
test('النسخة الاحتياطية بتفضل مشفّرة، ونسخة بمفتاح تاني أو بملف تالف بتترفض، والعادية القديمة بتتشفّر عند الاستيراد', () => {
  const { session, dbPath, folder } = makeSession('s10')
  session.setup(PASSWORD)
  const key = session.dbKey()
  getDb().prepare("INSERT INTO settings(key, value) VALUES ('shop_name', 'قبل')").run()

  const out = path.join(folder, 'backup.sqlite')
  backup.exportTo(out, dbPath)
  assert.ok(!isPlaintextDb(out))

  getDb().prepare("UPDATE settings SET value = 'بعد' WHERE key = 'shop_name'").run()
  backup.importFrom(out, dbPath, key)
  assert.deepEqual(getDb().prepare('SELECT value FROM settings WHERE key = ?').get('shop_name'), { value: 'قبل' })
  assert.ok(!isPlaintextDb(dbPath))

  // نسخة مشفّرة بمفتاح تاني
  const foreign = path.join(folder, 'foreign.sqlite')
  const other = createDatabase(foreign, {}, 'cd'.repeat(32))
  other.exec('CREATE TABLE categories(id)')
  other.close()
  assert.equal(err(() => backup.validateDbFile(foreign, key)), 'BACKUP_KEY_MISMATCH')

  // نسخة عادية قديمة
  const legacy = path.join(folder, 'legacy.sqlite')
  fs.copyFileSync(dbPath, legacy)
  closeDb()
  const plain = createDatabase(legacy, {}, key)
  plain.pragma("rekey = ''")
  plain.close()
  assert.ok(isPlaintextDb(legacy))
  openDb(dbPath, key)
  backup.importFrom(legacy, dbPath, key)
  assert.ok(!isPlaintextDb(dbPath))
  assert.deepEqual(getDb().prepare('SELECT value FROM settings WHERE key = ?').get('shop_name'), { value: 'قبل' })
  session.lock()
})

test('استرجاع على جهاز جديد: نسخة + خزنتها + كلمة السر، وكلمة غلط أو خزنة تالفة بتترفض', () => {
  const a = makeSession('r1')
  a.session.setup(PASSWORD)
  getDb().prepare("INSERT INTO settings(key, value) VALUES ('shop_name', 'من الجهاز القديم')").run()
  const out = path.join(a.folder, 'b.sqlite')
  backup.exportTo(out, a.dbPath, (to) => a.session.exportVault(to))
  assert.ok(fs.existsSync(backup.vaultCopyPath(out)))
  a.session.lock()

  const b = makeSession('r2')
  const vault = parseVault(fs.readFileSync(backup.vaultCopyPath(out), 'utf8'))
  const install = (key: string) => {
    fs.copyFileSync(out, b.dbPath)
    createDatabase(b.dbPath, {}, key).close()
  }
  assert.equal(err(() => b.session.restore(vault, 'wrong password 1', install)), 'WRONG_PASSWORD')
  assert.equal(b.session.state(), 'setup')
  b.session.restore(vault, PASSWORD, install)
  assert.equal(b.session.state(), 'unlocked')
  assert.deepEqual(getDb().prepare('SELECT value FROM settings WHERE key = ?').get('shop_name'), { value: 'من الجهاز القديم' })
  b.session.lock()
  b.session.unlock(PASSWORD) // الخزنة اتحفظت على الجهاز الجديد
  assert.equal(err(() => b.session.restore(vault, PASSWORD, install)), 'ALREADY_SETUP')
  b.session.lock()
  assert.throws(() => parseVault('{"version":2}'), /INVALID_VAULT/)
})

test('استيراد نسخة من جهاز تاني والبرنامج متسطّب بكلمة سر تانية: بكلمة سر الجهاز القديم أو مفتاح استرجاعه، وكلمة سر الجهاز الجديد بتفضل زي ما هي', () => {
  // الجهاز القديم: نسخة + خزنتها
  const a = makeSession('f1')
  const recoveryA = a.session.setup(PASSWORD)
  getDb().prepare("INSERT INTO settings(key, value) VALUES ('shop_name', 'الجهاز القديم')").run()
  const out = path.join(a.folder, 'old.sqlite')
  backup.exportTo(out, a.dbPath, (to) => a.session.exportVault(to))
  a.session.lock()
  const vaultA = parseVault(fs.readFileSync(backup.vaultCopyPath(out), 'utf8'))

  // الجهاز الجديد: متسطّب بكلمة سر تانية والاستيراد العادي بيرفض النسخة
  const b = makeSession('f2')
  const PASSWORD_B = 'another pass 2'
  b.session.setup(PASSWORD_B)
  getDb().prepare("INSERT INTO settings(key, value) VALUES ('shop_name', 'الجهاز الجديد')").run()
  assert.equal(err(() => backup.importFrom(out, b.dbPath, b.session.dbKey())), 'BACKUP_KEY_MISMATCH')

  // كلمة سر غلط (حتى كلمة سر الجهاز الجديد) بتترفض والداتا زي ما هي
  assert.equal(err(() => b.session.foreignBackupKey(vaultA, PASSWORD_B)), 'BACKUP_WRONG_PASSWORD')
  assert.equal(err(() => b.session.foreignBackupKey(vaultA, '')), 'BACKUP_WRONG_PASSWORD')
  assert.deepEqual(getDb().prepare('SELECT value FROM settings WHERE key = ?').get('shop_name'), { value: 'الجهاز الجديد' })

  // خزنة نسخة تانية مع الملف ده = مش بتاعته
  const foreignVault = createVault('some other 3').vault
  const wrongKey = b.session.foreignBackupKey(foreignVault, 'some other 3')
  assert.equal(err(() => backup.importForeign(out, wrongKey, b.dbPath, b.session.dbKey())), 'BACKUP_KEY_MISMATCH')
  assert.ok(!fs.existsSync(`${b.dbPath}.incoming`), 'الملف المؤقت بيتشال')

  // كلمة سر الجهاز القديم: الداتا بتاعته بتيجي وبتتشفّر بمفتاح الجهاز الجديد
  const keyA = b.session.foreignBackupKey(vaultA, PASSWORD)
  const { safetyPath } = backup.importForeign(out, keyA, b.dbPath, b.session.dbKey())
  assert.ok(fs.existsSync(safetyPath), 'نسخة أمان من الداتا القديمة')
  assert.deepEqual(getDb().prepare('SELECT value FROM settings WHERE key = ?').get('shop_name'), { value: 'الجهاز القديم' })

  // بعد القفل: البرنامج بيتفتح بكلمة سر الجهاز الجديد، والقديمة لأ
  b.session.lock()
  assert.equal(err(() => b.session.unlock(PASSWORD)), 'WRONG_PASSWORD')
  b.session.unlock(PASSWORD_B)
  assert.deepEqual(getDb().prepare('SELECT value FROM settings WHERE key = ?').get('shop_name'), { value: 'الجهاز القديم' })

  // مفتاح استرجاع الجهاز القديم بيفتح النسخة برضه
  assert.equal(b.session.foreignBackupKey(vaultA, recoveryA.toLowerCase()), keyA)
  b.session.lock()
  assert.equal(err(() => b.session.foreignBackupKey(vaultA, PASSWORD)), 'LOCKED', 'لازم البرنامج يكون مفتوح')
})
