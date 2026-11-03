import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Condition, Purchase, ReturnInput, ReturnKind, Sale } from '@shared/types'
import { Field, FormActions, Input, NumberInput, Select } from '@/shared/components/ui'
import { useSubmit } from '@/shared/hooks/useSubmit'
import { customerLabel } from '@/shared/utils/partyName'
import { useWorkspaces } from '../../workspaces'
import { bilingualName, formatDate, formatMoney, todayString } from '@/shared/utils/format'
import { purchasesApi } from '../../purchases'
import { salesApi } from '../../sales'

interface ReturnLineState {
  item_id: number
  name: string
  condition: Condition
  original: number
  quantity: string
  unit_price: string
  /** مرتجع بيع: السطر جاي من مخزن تاني (null = مخزن الفاتورة)، وهل يرجع له */
  source: number | null
  to_source: boolean
}

interface ReturnFormProps {
  sales: Sale[]
  purchases: Purchase[]
  onSubmit: (payload: ReturnInput) => Promise<unknown>
  onCancel: () => void
}

/** المرتجع بيتعمل على فاتورة موجودة: بنختار الفاتورة وبنحدد الكمية المرتجعة لكل منتج */
export function ReturnForm({ sales, purchases, onSubmit, onCancel }: ReturnFormProps) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const { workspaces, label } = useWorkspaces()
  const storeName = (id: number) => {
    const ws = workspaces.find((w) => w.id === id)
    return ws ? label(ws) : `#${id}`
  }
  const [type, setType] = useState<ReturnKind>('sale')
  const [invoiceId, setInvoiceId] = useState('')
  const [lines, setLines] = useState<ReturnLineState[]>([])
  const [meta, setMeta] = useState({ date: todayString(), reason: '' })

  const isSale = type === 'sale'

  async function pickInvoice(id: string) {
    setInvoiceId(id)
    if (!id) return setLines([])
    if (isSale) {
      const sale = await salesApi.get({ id: Number(id) })
      setLines((sale?.items ?? []).map((l) => ({ item_id: l.item_id, name: bilingualName(l), condition: l.condition, original: l.quantity, quantity: '0', unit_price: String(l.selling_price), source: l.source_workspace_id, to_source: false })))
    } else {
      const purchase = await purchasesApi.get({ id: Number(id) })
      setLines((purchase?.items ?? []).map((l) => ({ item_id: l.item_id, name: bilingualName(l), condition: l.condition, original: l.quantity, quantity: '0', unit_price: String(l.landed_cost), source: null, to_source: false })))
    }
  }

  function changeType(next: ReturnKind) {
    setType(next)
    setInvoiceId('')
    setLines([])
  }

  const setLine = (index: number, patch: Partial<ReturnLineState>) => setLines(lines.map((l, i) => (i === index ? { ...l, ...patch } : l)))
  const total = lines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0), 0)

  const { submit, saving } = useSubmit(() =>
    onSubmit({
      type,
      sale_id: isSale ? Number(invoiceId) : null,
      purchase_id: isSale ? null : Number(invoiceId),
      return_date: meta.date,
      reason: meta.reason,
      items: lines
        .filter((l) => Number(l.quantity) > 0)
        .map((l) => ({ item_id: l.item_id, condition: l.condition, quantity: l.quantity, unit_price: l.unit_price, ...(l.to_source ? { to_source: true } : {}) }))
    })
  )

  const invoiceOptions = isSale
    ? sales.map((s) => ({ id: s.id, label: `#${s.id} — ${s.customer_name ? customerLabel(s.customer_name, s.customer_is_partner, t) : ''} — ${formatDate(s.sale_date)}` }))
    : purchases.map((p) => ({ id: p.id, label: `#${p.id} — ${p.supplier_name} — ${formatDate(p.purchase_date)}` }))

  const th = 'border-b border-slate-200 bg-slate-50 px-3 py-2.5 text-start text-xs font-bold text-slate-500'
  const anyForeign = lines.some((l) => l.source !== null)

  return (
    <form onSubmit={submit}>
      <div className="grid grid-cols-2 gap-x-4">
        <Field label={t('returns.type')}>
          <Select value={type} onChange={(e) => changeType(e.target.value as ReturnKind)}>
            <option value="sale">{t('returns.typeSale')}</option>
            <option value="purchase">{t('returns.typePurchase')}</option>
          </Select>
        </Field>
        <Field label={t('returns.invoice')}>
          <Select value={invoiceId} onChange={(e) => pickInvoice(e.target.value)}>
            <option value="">{t('common.choose')}</option>
            {invoiceOptions.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </Select>
        </Field>
      </div>

      {lines.length > 0 && (
        <>
          <p className="mb-2">{t('returns.pickLines')}</p>
          <table className="mb-3 w-full border-separate border-spacing-0 overflow-hidden rounded-2xl bg-surface shadow-card">
            <thead>
              <tr>
                <th className={th}>{t('common.product')}</th>
                <th className={th}>{t('condition.label')}</th>
                <th className={th}>{t('returns.soldQuantity')}</th>
                <th className={th}>{t('returns.returnQuantity')}</th>
                <th className={th}>{t('returns.unitPrice')}</th>
                {anyForeign && <th className={th}>{t('returns.toSourceHeader')}</th>}
              </tr>
            </thead>
            <tbody>
              {lines.map((l, index) => (
                <tr key={index}>
                  <td className="px-3 py-2">{l.name}</td>
                  <td className="px-3 py-2">
                    {/* المرتجع ممكن يرجع بحالة مختلفة عن اللي اتباع بيها (مثلًا رجع تالف) */}
                    <Select value={l.condition} onChange={(e) => setLine(index, { condition: e.target.value as Condition })}>
                      <option value="new">{t('condition.new')}</option>
                      <option value="damaged">{t('condition.damaged')}</option>
                    </Select>
                  </td>
                  <td className="px-3 py-2">{l.original}</td>
                  <td className="px-3 py-2"><NumberInput max={l.original} value={l.quantity} onChange={(e) => setLine(index, { quantity: e.target.value })} /></td>
                  <td className="px-3 py-2"><NumberInput value={l.unit_price} onChange={(e) => setLine(index, { unit_price: e.target.value })} /></td>
                  {anyForeign && (
                    <td className="px-3 py-2">
                      {l.source !== null && (
                        <label className="flex items-center gap-2 whitespace-nowrap text-sm">
                          <input type="checkbox" className="h-4 w-4 accent-primary-600" checked={l.to_source} onChange={(e) => setLine(index, { to_source: e.target.checked })} />
                          {t('returns.toSource', { name: storeName(l.source) })}
                        </label>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {anyForeign && <p className="mb-3 text-sm text-slate-500">{t('returns.toSourceNote')}</p>}
        </>
      )}

      <div className="grid grid-cols-2 gap-x-4">
        <Field label={t('common.date')}><Input type="date" value={meta.date} onChange={(e) => setMeta({ ...meta, date: e.target.value })} /></Field>
        <Field label={t('returns.reason')}><Input value={meta.reason} onChange={(e) => setMeta({ ...meta, reason: e.target.value })} /></Field>
      </div>

      <p className="mt-4 text-end text-[17px]"><strong>{t('common.total')}: {formatMoney(total, lang)}</strong></p>
      <FormActions saving={saving} onCancel={onCancel} />
    </form>
  )
}
