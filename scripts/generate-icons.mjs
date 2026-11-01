// بيولّد أيقونات التطبيق من resources/icon.svg:
//   build/icon.ico  → أيقونة ملف التنصيب والبرنامج على ويندوز (16..256)
//   build/icon.png  → 512×512
//   resources/icon.png → أيقونة نافذة التطبيق
//   src/assets/logo.svg → الشعار داخل القايمة الجانبية
// التشغيل: npm run icons
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pngToIco from 'png-to-ico'
import sharp from 'sharp'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const svg = fs.readFileSync(path.join(root, 'resources/icon.svg'))
const png = (size) => sharp(svg, { density: 384 }).resize(size, size).png().toBuffer()

const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]
const ico = await pngToIco(await Promise.all(ICO_SIZES.map(png)))

fs.mkdirSync(path.join(root, 'build'), { recursive: true })
fs.writeFileSync(path.join(root, 'build/icon.ico'), ico)
fs.writeFileSync(path.join(root, 'build/icon.png'), await png(512))
fs.writeFileSync(path.join(root, 'resources/icon.png'), await png(256))
fs.copyFileSync(path.join(root, 'resources/icon.svg'), path.join(root, 'src/assets/logo.svg'))
console.log('icons generated:', ICO_SIZES.join(', '), '+ 512 png')
