import fs from 'node:fs/promises'
import path from 'node:path'
import type { IpcContext } from '../../lib/context'
import { AppError } from '../../lib/errors'
import type { HandleFn } from '../../lib/ipc'
import { whatsappPhone } from '../../lib/phone'

/** أقصى حجم للـ HTML اللي بيتبعت للتصوير (فاتورة كبيرة بالـ CSS بتاعها أقل من كده بكتير) */
const MAX_HTML = 8 * 1024 * 1024

/** اسم ملف آمن (من غير حروف ممنوعة في ويندوز) */
const safeName = (name: unknown) => String(name ?? 'invoice').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 80) || 'invoice'

/**
 * مشاركة الفاتورة على واتساب ويب جوه البرنامج (نافذة واحدة، مفيش تابات):
 * البرنامج بيفتح الشات (أو شاشة "ابعت لـ..." لو مفيش رقم) وبيحط الفاتورة فيه لوحده، وانت بتدوس إرسال.
 * - صورة: بتتنسخ كمان (لو اللصق التلقائي معرفش، Ctrl+V) وبتتحفظ PNG في الفولدر المؤقت.
 * - PDF: بيتحفظ في الفولدر المؤقت، ولو معرفناش نحطه في الشات الفولدر بيتفتح علشان تسحبه.
 * الرقم المصري المحلي بيتحط قبله 20، والرقم الغلط بيترفض قبل أي حاجة.
 */
export function register(handle: HandleFn, { app, clipboard, shell, capture, whatsapp, openWhatsApp }: IpcContext): void {
  // زرار الرئيسية: واتساب جوه البرنامج من غير فاتورة
  handle('share:open-whatsapp', () => openWhatsApp())

  const shareDir = () => path.join(app.getPath('temp'), `${app.getName()}-share`)

  /** الفاضي = تختار الشات من واتساب، والمكتوب غلط بيترفض */
  function phoneOf(phone: string | null | undefined): string | null {
    const number = whatsappPhone(phone)
    if (String(phone ?? '').trim() && !number) throw new AppError('INVALID_PHONE')
    return number
  }
  const messageOf = (text: unknown) => String(text ?? '').slice(0, 500)

  handle<{ html: string; name: string; phone?: string | null; text?: string }, { withPhone: boolean }>('share:whatsapp-image', async ({ html, name, phone, text }) => {
    if (typeof html !== 'string' || !html || html.length > MAX_HTML) throw new AppError('INVALID_DATA')
    const number = phoneOf(phone)
    const image = await capture(html, shareDir())
    if (image.isEmpty()) throw new AppError('CAPTURE_FAILED')
    clipboard.writeImage(image)
    await fs.writeFile(path.join(shareDir(), `${safeName(name)}.png`), image.toPNG())
    await whatsapp({ phone: number, text: messageOf(text), attachment: { kind: 'image' } })
    return { withPhone: number !== null }
  })

  // الواجهة بتعرض الفاتورة في منطقة الطباعة قبل ما تنادي (زي حفظ الـ PDF العادي)
  handle<{ name: string; phone?: string | null; text?: string }, { withPhone: boolean }>('share:whatsapp-pdf', async ({ name, phone, text }, event) => {
    const number = phoneOf(phone)
    await fs.mkdir(shareDir(), { recursive: true })
    const fileName = `${safeName(name)}.pdf`
    const file = path.join(shareDir(), fileName)
    const data = Buffer.from(await event.sender.printToPDF({ pageSize: 'A4', printBackground: true }))
    await fs.writeFile(file, data)
    await whatsapp({
      phone: number,
      text: messageOf(text),
      attachment: { kind: 'file', name: fileName, mime: 'application/pdf', data },
      onAttachFailed: () => shell.showItemInFolder(file)
    })
    return { withPhone: number !== null }
  })
}
