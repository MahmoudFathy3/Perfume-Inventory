import fs from 'node:fs/promises'
import path from 'node:path'
import { BrowserWindow } from 'electron'
import type { NativeImage } from 'electron'

/** عرض الصفحة (نفس عرض الفاتورة) ودقة الصورة (2 = ضعف علشان تبقى واضحة على الموبايل) */
const PAGE_WIDTH = 820
const SCALE = 2
const MAX_HEIGHT = 8000

/**
 * بترسم HTML (فاتورة بالـ CSS بتاعها) في نافذة مخفية offscreen بطول المحتوى كله وبترجّعه صورة.
 * الملف بيتكتب في الفولدر المؤقت ويتفتح كـ file:// علشان الخطوط والصور اللي جواه تتحمّل.
 * النافذة معزولة (sandbox ومن غير Node) ومبتتنقلش لأي حتة، وبتتقفل بعد التصوير.
 */
export async function renderHtmlToImage(html: string, dir: string): Promise<NativeImage> {
  await fs.mkdir(dir, { recursive: true })
  const file = path.join(dir, `capture-${Date.now()}.html`)
  await fs.writeFile(file, html, 'utf8')

  const win = new BrowserWindow({
    show: false,
    width: PAGE_WIDTH * SCALE,
    height: 1200,
    useContentSize: true,
    webPreferences: { offscreen: true, sandbox: true, contextIsolation: true, nodeIntegration: false, devTools: false }
  })
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', (event) => event.preventDefault())

  try {
    await win.loadFile(file)
    win.webContents.setZoomFactor(SCALE)
    // نستنى الخطوط تتحمّل علشان الطول يتحسب صح
    const height = Number(await win.webContents.executeJavaScript('document.fonts.ready.then(() => Math.ceil(document.documentElement.scrollHeight))'))
    win.setContentSize(PAGE_WIDTH * SCALE, Math.min(Math.max(height, 100), MAX_HEIGHT) * SCALE)
    return await nextFrame(win)
  } finally {
    win.destroy()
    void fs.rm(file, { force: true })
  }
}

/** أول frame كامل بعد تغيير المقاس (offscreen بيرسم في event اسمه paint) */
function nextFrame(win: BrowserWindow): Promise<NativeImage> {
  return new Promise((resolve, reject) => {
    const [width, height] = win.getContentSize()
    const timer = setTimeout(() => {
      win.webContents.off('paint', onPaint)
      // لو مجاش paint (نادر) بنصوّر اللي موجود
      win.webContents.capturePage().then(resolve, reject)
    }, 3000)
    const onPaint = (_event: unknown, _dirty: unknown, image: NativeImage) => {
      const size = image.getSize()
      if (size.width < width || size.height < height) return // لسه بيرسم بالمقاس القديم
      clearTimeout(timer)
      win.webContents.off('paint', onPaint)
      resolve(image)
    }
    win.webContents.on('paint', onPaint)
    win.webContents.invalidate()
  })
}
