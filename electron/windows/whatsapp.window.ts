import { BrowserWindow, session, shell } from 'electron'
import type { WebContents } from 'electron'

/**
 * واتساب ويب جوه البرنامج: نافذة واحدة بتتفتح تاني كل مرة (مفيش تابات)، وتسجيل الدخول (QR) بيتحفظ
 * في session لوحدها (persist:whatsapp) بعيد عن البرنامج. النافذة معزولة: sandbox ومن غير Node ومن غير preload،
 * ومبتتنقلش برا web.whatsapp.com (أي رابط تاني بيتفتح في المتصفح).
 * البرنامج بيفتح الشات وبيحط الفاتورة فيه لوحده (الصورة باللصق، والـ PDF كملف)، وانت بتدوس إرسال.
 *
 * - برقم: بنحمّل رابط الشات (واتساب مبيفتحش شات برقم غير كده)، والدخول بيفضل محفوظ.
 * - من غير رقم وواتساب مفتوح: مفيش تحميل، بتدوس على أي شات من القايمة وأول ما يتفتح الفاتورة بتتحط فيه.
 */
const ORIGIN = 'https://web.whatsapp.com'
const PARTITION = 'persist:whatsapp'

/** خانة الكتابة في الشات (أكتر من شكل علشان لو واتساب غيّر حاجة بسيطة) */
const COMPOSER = `(() => {
  const selectors = ['footer div[contenteditable="true"][role="textbox"]', 'footer div[contenteditable="true"]', 'div[contenteditable="true"][data-tab="10"]']
  for (const s of selectors) { const el = document.querySelector(s); if (el) return el }
  return null
})()`
/** واتساب محمّل ومسجّل دخول (قايمة المحادثات ظاهرة) */
const APP_READY = `!!document.querySelector('#pane-side')`
/**
 * اسم الشات المفتوح (علشان نعرف إن شات تاني اتفتح): أول سطر في شريط الشات بس،
 * لأن اللي تحته ("متصل" / "بيكتب..." / آخر ظهور) بيتغيّر لوحده والشات هو هو
 */
const CHAT_TITLE = `((document.querySelector('#main header span[dir="auto"]')?.textContent
  ?? (document.querySelector('#main header')?.innerText ?? '').split('\\n')[0]) ?? '').trim()`

export type WhatsAppAttachment = { kind: 'image' } | { kind: 'file'; name: string; mime: string; data: Buffer }

export interface WhatsAppShareOptions {
  /** رقم بالكود الدولي، أو null = تختار الشات بنفسك */
  phone: string | null
  text: string
  /** image = الصورة اللي في الـ clipboard، file = ملف (PDF) */
  attachment: WhatsAppAttachment
  /** لو معرفناش نحط الفاتورة في الشات (واتساب اتغيّر أو محدش اختار شات) */
  onAttachFailed?: () => void
}

let win: BrowserWindow | null = null
let attachRun = 0

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** user agent بتاع كروم (واتساب ويب مبيفتحش لو شاف Electron) */
const chromeUserAgent = () =>
  `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${process.versions.chrome} Safari/537.36`

function openInBrowser(url: string): void {
  if (/^https?:\/\//i.test(url)) void shell.openExternal(url)
}

function getWindow(): BrowserWindow {
  if (win && !win.isDestroyed()) return win
  const ses = session.fromPartition(PARTITION)
  ses.setUserAgent(chromeUserAgent())
  // الإشعارات بس (رسايل جديدة)، وأي صلاحية تانية مرفوضة
  ses.setPermissionRequestHandler((_wc, permission, callback) => callback(permission === 'notifications'))

  win = new BrowserWindow({
    width: 1100,
    height: 800,
    title: 'WhatsApp',
    autoHideMenuBar: true,
    webPreferences: { partition: PARTITION, sandbox: true, contextIsolation: true, nodeIntegration: false, devTools: false }
  })
  const contents = win.webContents
  contents.setWindowOpenHandler(({ url }) => {
    openInBrowser(url)
    return { action: 'deny' }
  })
  contents.on('will-navigate', (event, url) => {
    if (url.startsWith(ORIGIN)) return
    event.preventDefault()
    openInBrowser(url)
  })
  contents.on('will-attach-webview', (event) => event.preventDefault())
  // القفل بيخفيها بس (علشان متتحمّلش من الأول كل مرة)، والقفل اليدوي (X) بيخفيها برضه
  win.on('close', (event) => {
    if (!quitting) {
      event.preventDefault()
      win?.hide()
    }
  })
  win.on('closed', () => {
    win = null
  })
  return win
}

/** البرنامج بيقفل خالص (النافذة الرئيسية اتقفلت أو خروج): نافذة واتساب تتقفل بجد علشان البرنامج يخرج */
let quitting = false
export function closeWhatsApp(): void {
  quitting = true
  if (win && !win.isDestroyed()) win.destroy()
}

async function js<T>(contents: WebContents, code: string): Promise<T | null> {
  try {
    return (await contents.executeJavaScript(code)) as T
  } catch {
    return null // الصفحة بتتحمّل
  }
}

/** بيستنى الشرط يتحقق (كل 700ms) لحد الوقت ما يخلص، أو مشاركة جديدة تبدأ */
async function waitFor(contents: WebContents, check: () => Promise<boolean>, timeoutMs: number, run: number): Promise<boolean> {
  const end = Date.now() + timeoutMs
  while (Date.now() < end) {
    if (contents.isDestroyed() || run !== attachRun) return false
    if (await check()) return true
    await sleep(700)
  }
  return false
}

const hasComposer = (contents: WebContents) => async () => !!(await js<boolean>(contents, `!!${COMPOSER}`))

/** شات تاني غير اللي كان مفتوح اتفتح (وفيه خانة كتابة): بنقارن اسم الشات بس */
const chatChanged = (contents: WebContents, before: string) => async () => {
  if (!(await hasComposer(contents)())) return false
  const title = await js<string>(contents, CHAT_TITLE)
  return !!title && title !== before
}

/** بيحط الفاتورة في الشات المفتوح: الصورة باللصق (زي Ctrl+V)، والملف كأنه اتلصق، والرسالة كتعليق */
async function attach(contents: WebContents, options: WhatsAppShareOptions, withCaption: boolean): Promise<void> {
  await js(contents, `(() => { const el = ${COMPOSER}; if (el) el.focus(); return !!el })()`)
  if (options.attachment.kind === 'image') {
    contents.paste()
  } else {
    const { name, mime, data } = options.attachment
    const ok = await js<boolean>(contents, `(() => {
      const el = ${COMPOSER}
      if (!el) return false
      const bytes = Uint8Array.from(atob(${JSON.stringify(data.toString('base64'))}), (c) => c.charCodeAt(0))
      const transfer = new DataTransfer()
      transfer.items.add(new File([bytes], ${JSON.stringify(name)}, { type: ${JSON.stringify(mime)} }))
      el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: transfer, bubbles: true, cancelable: true }))
      return true
    })()`)
    if (!ok) throw new Error('composer not found')
  }
  // الرسالة بتتكتب تعليق على الفاتورة (شاشة المعاينة بتفتح والتعليق عليه الفوكس)
  if (withCaption && options.text.trim()) {
    await sleep(1500)
    await js(contents, `document.execCommand('insertText', false, ${JSON.stringify(options.text)})`)
  }
}

/** بيستنى الشات وبيحط الفاتورة فيه (في الخلفية) */
function attachWhenReady(contents: WebContents, options: WhatsAppShareOptions, ready: () => Promise<boolean>, timeoutMs: number, withCaption: boolean, run: number): void {
  void (async () => {
    if (!(await waitFor(contents, ready, timeoutMs, run))) {
      if (run === attachRun) options.onAttachFailed?.()
      return
    }
    try {
      await sleep(800) // الشات يكمّل تحميل
      await attach(contents, options, withCaption)
    } catch {
      options.onAttachFailed?.()
    }
  })()
}

/**
 * بيفتح واتساب جوه البرنامج على الشات وبيحط الفاتورة فيه أول ما الشات يتفتح.
 * بيرجع بعد ما الشات يبدأ يتفتح، والحط في الشات بيكمّل في الخلفية (بيستنى لحد ما تختار الشات).
 */
export async function shareOnWhatsApp(options: WhatsAppShareOptions): Promise<void> {
  const window = getWindow()
  const contents = window.webContents
  const run = ++attachRun // مشاركة جديدة بتلغي اللي قبلها لو لسه مستنية
  if (window.isMinimized()) window.restore()
  window.show()
  window.focus()

  // من غير رقم وواتساب محمّل: مفيش تحميل، بتدوس على أي شات من القايمة وأول ما شات جديد يتفتح الفاتورة بتتحط فيه
  const loaded = contents.getURL().startsWith(ORIGIN) && !!(await js<boolean>(contents, APP_READY))
  if (loaded && !options.phone) {
    const before = (await js<string>(contents, CHAT_TITLE)) ?? ''
    return attachWhenReady(contents, options, chatChanged(contents, before), 180_000, true, run)
  }

  // برقم (أو أول مرة): بنحمّل رابط الشات، وده الطريقة الوحيدة اللي واتساب بيفتح بيها شات برقم (الدخول بيفضل محفوظ).
  // من غير رقم لازم رسالة علشان شاشة "ابعت لـ..." تظهر
  const params = new URLSearchParams()
  if (options.phone) params.set('phone', options.phone)
  else params.set('text', options.text.trim() || ' ')
  await window.loadURL(`${ORIGIN}/send?${params.toString().replace(/\+/g, '%20')}`)
  // برقم الشات بيتفتح لوحده، ومن غير رقم بنستنى لحد ما تختار الشات (والرسالة اتكتبت من الرابط)
  attachWhenReady(contents, options, hasComposer(contents), options.phone ? 60_000 : 180_000, !!options.phone, run)
}

/** قفل البرنامج بيخفي نافذة واتساب (المحادثات مبتفضلش ظاهرة والبرنامج مقفول) */
export function hideWhatsApp(): void {
  if (win && !win.isDestroyed()) win.hide()
}
