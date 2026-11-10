import { MessageCircle, Printer, UserRound } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { usePrint } from '../../print/PrintProvider'
import { formatMoney } from '../../utils/format'
import { Button, Modal } from '../ui'
import { CustomerNameLabel } from './CustomerNameLabel'
import { InvoiceDocument } from './InvoiceDocument'
import type { InvoiceDocData } from './invoice.types'
import { useShopInfo } from './useShopInfo'
import { WhatsAppShareDialog } from './WhatsAppShareDialog'

/** نافذة عرض الفاتورة مع زرار طباعة وحفظ PDF ومشاركة على واتساب (صورة أو PDF، للعميل أو أي شات) */
export function InvoiceViewer({ data, onClose }: { data: InvoiceDocData; onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const shop = useShopInfo()
  const { print, savePdf } = usePrint()
  const [sharing, setSharing] = useState(false)
  const document = <InvoiceDocument data={data} shop={shop} />
  const title = t(`invoice.${data.kind}Title`)
  const fileName = `${title}-${data.id}`
  const message = t('share.defaultMessage', { title, id: data.id, total: formatMoney(data.total, i18n.language) })

  return (
    <Modal title={`${title} #${data.id}`} onClose={onClose} wide>
      <div className="mb-3 flex flex-wrap gap-2">
        <Button variant="primary" icon={Printer} onClick={() => print(document)}>{t('common.print')}</Button>
        <Button onClick={() => savePdf(document, fileName)}>{t('common.savePdf')}</Button>
        <Button icon={MessageCircle} onClick={() => setSharing(true)}>{t('share.whatsapp')}</Button>
        {data.kind === 'sale' && data.party && (
          <Button icon={UserRound} onClick={() => print(<CustomerNameLabel name={data.party!} />)}>{t('invoice.printName')}</Button>
        )}
      </div>
      <div className="overflow-auto rounded-xl border border-slate-200 bg-slate-100 p-4">{document}</div>
      {sharing && <WhatsAppShareDialog document={document} fileName={fileName} phone={data.phone} message={message} onClose={() => setSharing(false)} />}
    </Modal>
  )
}
