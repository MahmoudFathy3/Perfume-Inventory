import { Printer, UserRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { usePrint } from '../../print/PrintProvider'
import { Button, Modal } from '../ui'
import { CustomerNameLabel } from './CustomerNameLabel'
import { InvoiceDocument } from './InvoiceDocument'
import type { InvoiceDocData } from './invoice.types'
import { useShopInfo } from './useShopInfo'

/** نافذة عرض الفاتورة مع زرار طباعة وحفظ PDF */
export function InvoiceViewer({ data, onClose }: { data: InvoiceDocData; onClose: () => void }) {
  const { t } = useTranslation()
  const shop = useShopInfo()
  const { print, savePdf } = usePrint()
  const document = <InvoiceDocument data={data} shop={shop} />
  const fileName = `${t(`invoice.${data.kind}Title`)}-${data.id}`

  return (
    <Modal title={`${t(`invoice.${data.kind}Title`)} #${data.id}`} onClose={onClose} wide>
      <div className="mb-3 flex gap-2">
        <Button variant="primary" icon={Printer} onClick={() => print(document)}>{t('common.print')}</Button>
        <Button onClick={() => savePdf(document, fileName)}>{t('common.savePdf')}</Button>
        {data.kind === 'sale' && data.party && (
          <Button icon={UserRound} onClick={() => print(<CustomerNameLabel name={data.party!} />)}>{t('invoice.printName')}</Button>
        )}
      </div>
      <div className="overflow-auto rounded-xl border border-slate-200 bg-slate-100 p-4">{document}</div>
    </Modal>
  )
}
