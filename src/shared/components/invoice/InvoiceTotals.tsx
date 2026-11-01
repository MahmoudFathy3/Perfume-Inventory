import { useTranslation } from 'react-i18next'
import { formatMoney } from '../../utils/format'
import { Alert } from '../ui'

interface InvoiceTotalsProps {
  subtotal: number
  /** الشحن اللي بيتضاف على الفاتورة (شحن العميل / شحن الشراء) */
  shipping: number
  /** شحن بيدفعه المحل: مش بيتضاف على الفاتورة وبيتخصم من الربح */
  shopShipping?: number
  /** المدفوع (فواتير البيع): لو اتبعت بنعرض المدفوع والمتبقي */
  paid?: number
}

/** إجمالي الأصناف + الشحن = الإجمالي النهائي (+ المدفوع والمتبقي في البيع) */
export function InvoiceTotals({ subtotal, shipping, shopShipping = 0, paid }: InvoiceTotalsProps) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const total = subtotal + shipping
  const remaining = paid === undefined ? 0 : Math.max(0, Math.round((total - paid) * 100) / 100)
  return (
    <>
      <p className="mt-4 text-end text-[17px]">
        {t('common.subtotal')}: {formatMoney(subtotal, lang)} — <strong>{t('common.total')}: {formatMoney(total, lang)}</strong>
      </p>
      {paid !== undefined && (
        <p className="mt-1 text-end">
          {t('invoice.paid')}: {formatMoney(paid, lang)} — <strong className={remaining > 0 ? 'text-rose-600' : 'text-green-700'}>{t('invoice.remaining')}: {formatMoney(remaining, lang)}</strong>
        </p>
      )}
      {shopShipping > 0 && <Alert tone="info">{t('sales.shopPaysNote', { amount: formatMoney(shopShipping, lang) })}</Alert>}
    </>
  )
}
