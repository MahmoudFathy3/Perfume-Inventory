import { FileDown, ImageIcon, MessageCircle } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useWhatsAppShare } from '../../print/useWhatsAppShare'
import type { ShareFormat } from '../../print/useWhatsAppShare'
import { Button, Field, Input, Modal, Segmented } from '../ui'

type Recipient = 'customer' | 'number' | 'pick'

interface WhatsAppShareDialogProps {
  /** الفاتورة زي ما هتتطبع */
  document: ReactNode
  fileName: string
  /** تليفون العميل (لو مفيش، خيار العميل مبيظهرش) */
  phone: string | null | undefined
  /** الرسالة اللي بتتبعت مع الفاتورة */
  message: string
  onClose: () => void
}

/**
 * مشاركة الفاتورة على واتساب: صورة أو PDF، ولمين: العميل (على رقمه)، أو رقم تكتبه، أو تختار أي شات / جروب من واتساب.
 * الرسالة بتتبعت مع الفاتورة وتقدر تعدّلها.
 */
export function WhatsAppShareDialog({ document, fileName, phone, message, onClose }: WhatsAppShareDialogProps) {
  const { t } = useTranslation()
  const share = useWhatsAppShare()
  const hasPhone = !!phone?.trim()
  const [format, setFormat] = useState<ShareFormat>('image')
  const [recipient, setRecipient] = useState<Recipient>(hasPhone ? 'customer' : 'pick')
  const [number, setNumber] = useState('')
  const [text, setText] = useState(message)
  const [busy, setBusy] = useState(false)

  const target = recipient === 'customer' ? (phone ?? null) : recipient === 'number' ? number : null
  const recipients = [
    ...(hasPhone ? [{ value: 'customer' as const, label: t('share.toCustomer', { phone }) }] : []),
    { value: 'number' as const, label: t('share.toNumber') },
    { value: 'pick' as const, label: t('share.toPick') }
  ]

  async function send() {
    setBusy(true)
    const done = await share(format, document, fileName, target, text)
    setBusy(false)
    if (done) onClose()
  }

  return (
    <Modal title={t('share.title')} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-slate-500">{t('share.format')}</span>
          <Segmented
            value={format}
            onChange={setFormat}
            options={[
              { value: 'image', label: t('share.asImage') },
              { value: 'pdf', label: t('share.asPdf') }
            ]}
          />
          <small className="flex items-center gap-1.5 text-slate-500">
            {format === 'image' ? <ImageIcon size={14} /> : <FileDown size={14} />}
            {t(format === 'image' ? 'share.imageHow' : 'share.pdfHow')}
          </small>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-slate-500">{t('share.to')}</span>
          <Segmented value={recipient} onChange={setRecipient} options={recipients} />
          {recipient === 'pick' && <small className="text-slate-500">{t('share.pickHow')}</small>}
        </div>

        {recipient === 'number' && (
          <Field label={t('share.number')}>
            <Input value={number} dir="ltr" autoFocus placeholder="01012345678" onChange={(e) => setNumber(e.target.value)} />
          </Field>
        )}

        <Field label={t('share.message')}>
          <Input value={text} onChange={(e) => setText(e.target.value)} />
        </Field>
        <small className="text-slate-500">{t('share.loginNote')}</small>

        <div className="flex gap-2">
          <Button variant="primary" icon={MessageCircle} disabled={busy || (recipient === 'number' && !number.trim())} onClick={() => void send()}>
            {busy ? t('share.preparing') : t('share.send')}
          </Button>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
        </div>
      </div>
    </Modal>
  )
}
