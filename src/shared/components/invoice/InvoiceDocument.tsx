import { useTranslation } from 'react-i18next'
import { bilingualName, formatDate, formatMoney, formatNumber } from '../../utils/format'
import type { InvoiceDocData, ShopInfo } from './invoice.types'
import { useAppName } from '../../hooks/useAppName'

interface InvoiceDocumentProps {
  data: InvoiceDocData
  shop: ShopInfo
}

const cell = 'border border-slate-300 px-2.5 py-1.5 text-start'

/** الفاتورة نفسها (للعرض والطباعة): ورقة A4 بيضاء بدون ألوان تقيلة */
export function InvoiceDocument({ data, shop }: InvoiceDocumentProps) {
  const { t, i18n } = useTranslation()
  const { name: appName } = useAppName()
  const lang = i18n.language
  const money = (v: number) => formatMoney(v, lang)
  const subtotal = data.lines.reduce((sum, l) => sum + l.quantity * l.unit_price, 0)
  const isSupplierSide = data.kind === 'purchase' || data.kind === 'purchase_return'

  return (
    <article className="mx-auto w-full max-w-[780px] bg-white p-8 text-sm text-black">
      <header className="mb-6 flex items-start justify-between gap-6 border-b-2 border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl">{shop.shop_name || appName}</h1>
          {shop.shop_address && <p className="mt-1 text-slate-600">{shop.shop_address}</p>}
          {shop.shop_phone && (
            <p className="text-slate-600">
              {t('invoice.phone')}: <bdi dir="ltr">{shop.shop_phone}</bdi>
            </p>
          )}
        </div>
        <div className="text-end">
          <h2 className="text-xl">{t(`invoice.${data.kind}Title`)}</h2>
          <p>
            {t('invoice.number')}: <strong>#{data.id}</strong>
          </p>
          <p>
            {t('invoice.date')}: {formatDate(data.date)}
          </p>
        </div>
      </header>

      <section className="mb-4 flex gap-8">
        <p>
          {t(isSupplierSide ? 'invoice.supplier' : 'invoice.customer')}: <strong>{data.party || t('invoice.noParty')}</strong>
        </p>
        {data.priceType && (
          <p>
            {t('invoice.priceType')}: <strong>{t(`sales.${data.priceType}`)}</strong>
          </p>
        )}
      </section>

      <table className="mb-4 w-full border-collapse">
        <thead>
          <tr className="bg-slate-100">
            <th className={cell}>#</th>
            <th className={cell}>{t('invoice.product')}</th>
            <th className={cell}>{t('condition.label')}</th>
            <th className={cell}>{t('common.quantity')}</th>
            <th className={cell}>{t('invoice.unitPrice')}</th>
            <th className={cell}>{t('invoice.lineTotal')}</th>
          </tr>
        </thead>
        <tbody>
          {data.lines.map((l, i) => (
            <tr key={i}>
              <td className={cell}>{i + 1}</td>
              <td className={cell}>{bilingualName(l)}</td>
              <td className={cell}>{t(`condition.${l.condition}`)}</td>
              <td className={cell}>{formatNumber(l.quantity, lang)}</td>
              <td className={cell}>{money(l.unit_price)}</td>
              <td className={cell}>{money(l.quantity * l.unit_price)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="ms-auto w-72 space-y-1">
        <div className="flex justify-between">
          <span>{t('invoice.subtotal')}</span>
          <span>{money(subtotal)}</span>
        </div>
        {data.shipping > 0 && (
          <div className="flex justify-between">
            <span>{t('invoice.shipping')}</span>
            {/* لو الشحن على المحل مبيتحسبش على العميل */}
            <span>{data.shippingPayer === 'shop' ? t('invoice.freeShipping') : money(data.shipping)}</span>
          </div>
        )}
        <div className="flex justify-between border-t-2 border-slate-800 pt-1 text-base font-bold">
          <span>{t('invoice.total')}</span>
          <span>{money(data.total)}</span>
        </div>
        {/* مرتجع بيع: اللي اترد كاش، والباقي من قيمته اتحسب للعميل (اتخصم من اللي عليه أو بقى رصيد له) */}
        {data.kind === 'sale_return' && (
          <>
            <div className="flex justify-between">
              <span>{t('invoice.refunded')}</span>
              <span>{money(data.refunded ?? 0)}</span>
            </div>
            {data.total - (data.refunded ?? 0) > 0.005 && (
              <div className="flex justify-between">
                <span>{t('invoice.toAccount')}</span>
                <span>{money(data.total - (data.refunded ?? 0))}</span>
              </div>
            )}
          </>
        )}
        {/* فاتورة بيع لسه عليها متبقي أو عليها مرتجع: بنكتب كل رقم لوحده (المدفوع، المرتجع، اللي اترد، الرصيد، المتبقي) */}
        {data.kind === 'sale' && ((data.remaining ?? 0) > 0 || (data.returns ?? 0) > 0) && (
          <>
            <div className="flex justify-between">
              <span>{t('invoice.paid')}</span>
              <span>{money(data.paid ?? 0)}</span>
            </div>
            {(data.returns ?? 0) > 0 && (
              <div className="flex justify-between">
                <span>{t('invoice.returns')}</span>
                <span>{money(data.returns ?? 0)}</span>
              </div>
            )}
            {(data.refunded ?? 0) > 0 && (
              <div className="flex justify-between">
                <span>{t('invoice.refunded')}</span>
                <span>{money(data.refunded ?? 0)}</span>
              </div>
            )}
            {(data.creditUsed ?? 0) > 0 && (
              <div className="flex justify-between">
                <span>{t('invoice.creditUsed')}</span>
                <span>{money(data.creditUsed ?? 0)}</span>
              </div>
            )}
            {(data.credit ?? 0) > 0 && (
              <div className="flex justify-between font-bold">
                <span>{t('invoice.credit')}</span>
                <span>{money(data.credit ?? 0)}</span>
              </div>
            )}
            {(data.remaining ?? 0) > 0 && (
              <div className="flex justify-between font-bold">
                <span>{t('invoice.remaining')}</span>
                <span>{money(data.remaining ?? 0)}</span>
              </div>
            )}
          </>
        )}
      </section>

      {data.notes && (
        <p className="mt-5 text-slate-700">
          <strong>{t('invoice.notes')}:</strong> {data.notes}
        </p>
      )}
      <footer className="mt-10 border-t border-slate-300 pt-3 text-center text-slate-500">{t('invoice.thanks')}</footer>
    </article>
  )
}
