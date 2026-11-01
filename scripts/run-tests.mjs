// تشغيل اختبارات الـ backend.
// الاختبارات بتشتغل على Node العادي، والتطبيق بيشتغل على Electron، وكل واحد محتاج نسخة مختلفة من ملف SQLite الأصلي.
// علشان كده بنجهّز نسخة منفصلة للاختبارات في node_modules/.cache ومبنلمسش النسخة اللي التطبيق بيستخدمها.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = path.join(root, 'node_modules/better-sqlite3-multiple-ciphers')
const target = path.join(root, 'node_modules/.cache/better-sqlite3-ciphers-node')
const binding = path.join(target, 'build/Release/better_sqlite3.node')
const marker = path.join(target, '.node-abi')

function prepareBinding() {
  const upToDate = fs.existsSync(binding) && fs.existsSync(marker) && fs.readFileSync(marker, 'utf8') === process.versions.modules
  if (upToDate) return

  console.log(`تجهيز SQLite لـ Node ${process.versions.node} (مرة واحدة)...`)
  fs.rmSync(target, { recursive: true, force: true })
  fs.mkdirSync(target, { recursive: true })
  fs.copyFileSync(path.join(source, 'package.json'), path.join(target, 'package.json'))

  const prebuildInstall = createRequire(path.join(source, 'package.json')).resolve('prebuild-install/bin.js')
  const res = spawnSync(process.execPath, [prebuildInstall, '--runtime=node', `--target=${process.versions.node}`, '--force'], {
    cwd: target,
    stdio: 'inherit',
    env: { ...process.env, npm_config_runtime: 'node', npm_config_target: process.versions.node }
  })
  if (res.status !== 0 || !fs.existsSync(binding)) {
    console.error('فشل تجهيز ملف SQLite للاختبارات. تأكد من الاتصال بالإنترنت (بيتحمّل من GitHub) وجرّب تاني.')
    process.exit(1)
  }
  fs.writeFileSync(marker, process.versions.modules)
}

prepareBinding()

const test = spawnSync(process.execPath, ['--import', 'tsx', '--test', 'electron/tests/*.test.ts'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, BETTER_SQLITE3_BINDING: binding }
})
process.exit(test.status ?? 1)
