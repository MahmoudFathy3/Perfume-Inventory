import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { invoke } from '../api/ipc'
import { useToast } from '../toast/ToastProvider'
import { usePrint } from './PrintProvider'

export type ShareFormat = 'image' | 'pdf'

/** url(...) نسبي في الـ CSS بيتحوّل لرابط كامل (علشان الخطوط تتحمّل في نافذة التصوير) */
const absoluteUrls = (css: string, base: string) =>
  css.replace(/url\((['"]?)([^'")]+)\1\)/g, (match, _quote: string, url: string) => (url.startsWith('data:') ? match : `url("${new URL(url, base).href}")`))

/** كل CSS التطبيق (Tailwind والخطوط) كنص واحد */
function appCss(): string {
  let css = ''
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList
    try {
      rules = sheet.cssRules
    } catch {
      continue // شيت من مكان تاني مينفعش يتقري (مش موجود عندنا أصلًا)
    }
    const base = sheet.href ?? location.href
    for (const rule of Array.from(rules)) css += `${absoluteUrls(rule.cssText, base)}\n`
  }
  return css
}

/** صفحة HTML كاملة فيها الفاتورة بالـ CSS بتاعها (اللي بتتصوّر) */
function pageHtml(content: HTMLElement): string {
  const { dir, lang } = document.documentElement
  return `<!doctype html><html dir="${dir || 'rtl'}" lang="${lang || 'ar'}"><head><meta charset="utf-8" />
<style>${appCss()}</style><style>html, body { margin: 0; background: #fff; }</style></head><body>${content.innerHTML}</body></html>`
}

/**
 * مشاركة فاتورة على واتساب (صورة أو PDF): الفاتورة بتتجهّز وواتساب بيتفتح ومعاه الرسالة، وانت بتلصق الصورة / تسحب الملف.
 * phone = الرقم اللي هيتبعتله. فاضي = واتساب بيفتح شاشة "ابعت لـ..." وتختار أي شات أو جروب.
 * بيرجّع true لو اتجهّزت (علشان النافذة تتقفل).
 */
export function useWhatsAppShare() {
  const { t } = useTranslation()
  const toast = useToast()
  const { render } = usePrint()

  return async function share(format: ShareFormat, content: ReactNode, name: string, phone: string | null, text: string): Promise<boolean> {
    try {
      const result =
        format === 'image'
          ? await render(content, (root) => invoke<{ withPhone: boolean }>('share:whatsapp-image', { html: pageHtml(root), name, phone, text }))
          : await render(content, () => invoke<{ withPhone: boolean }>('share:whatsapp-pdf', { name, phone, text }))
      const how = t(format === 'image' ? 'share.imageReady' : 'share.pdfReady')
      toast.info(result.withPhone ? how : `${t('share.pickChat')} ${how}`)
      return true
    } catch (e) {
      toast.fail(e)
      return false
    }
  }
}
