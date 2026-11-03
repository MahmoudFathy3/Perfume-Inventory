import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Condition, Item, TransferDetails, TransferInput, TransferKind, Workspace } from '@shared/types'
import { ProductSelect } from '@/shared/components/data/ProductSelect'
import { Alert, Button, Field, FormActions, Input, NumberInput, Segmented, Select } from '@/shared/components/ui'
import { CONDITIONS } from '@/shared/constants'
import { useQuery } from '@/shared/hooks/useQuery'
import { useSubmit } from '@/shared/hooks/useSubmit'
import { formatMoney, todayString } from '@/shared/utils/format'
import { transfersApi } from '../api/transfers.api'

const PERSONAL_ID = 1
const KINDS: TransferKind[] = ['capital', 'sale', 'half']

interface Line {
  item_id: number | ''
  condition: Condition
  quantity: string
  price: string
}
const emptyLine = (): Line => ({ item_id: '', condition: 'new', quantity: '1', price: '' })

const linesOf = (transfer: TransferDetails): Line[] =>
  transfer.items.map((l) => ({
    item_id: l.from_item_id,
    condition: l.condition,
    quantity: String(l.quantity),
    price: transfer.kind === 'sale' ? String(l.unit_price) : ''
  }))

interface TransferFormProps {
  active: Workspace
  workspaces: Workspace[]
  nameOf: (workspaceId: number) => string
  /** تحويل موجود = فورم تعديل */
  initial?: TransferDetails | null
  onSubmit: (payload: TransferInput) => Promise<unknown>
  onCancel: () => void
}

/**
 * تحويل بين المخزون الفعلي وشراكة. بنقف في مخزن (النشط) ونختار الاتجاه:
 * "من هنا" أو "إلى هنا"، ونوع التحويل (رأس مال / بيع بسعر / بالنص) وقت التحويل نفسه.
 * مع initial بيبقى فورم تعديل بنفس بيانات التحويل.
 */
export function TransferForm({ active, workspaces, nameOf, initial = null, onSubmit, onCancel }: TransferFormProps) {
  const { t, i18n } = useTranslation()
  const activeIsPersonal = active.id === PERSONAL_ID
  const partnerships = workspaces.filter((w) => w.kind === 'partnership' && !w.closed_at)

  const initialOut = !initial || initial.from_workspace_id === active.id
  const initialOther = initial ? (initialOut ? initial.to_workspace_id : initial.from_workspace_id) : partnerships[0]?.id ?? 0

  const [direction, setDirection] = useState<'out' | 'in'>(initialOut ? 'out' : 'in')
  const [otherId, setOtherId] = useState<number>(activeIsPersonal ? initialOther : partnerships[0]?.id ?? 0)
  const [kind, setKind] = useState<TransferKind>(initial?.kind ?? 'capital')
  const [partnerId, setPartnerId] = useState<number>(initial?.partner_id ?? 0)
  const [header, setHeader] = useState({ date: initial?.transfer_date ?? todayString(), notes: initial?.notes ?? '' })
  const [lines, setLines] = useState<Line[]>(initial ? linesOf(initial) : [emptyLine()])

  // الطرف التاني: لو واقفين في المخزون الفعلي بنختار الشراكة، ولو واقفين في شراكة فالطرف التاني هو المخزون الفعلي
  const peerId = activeIsPersonal ? otherId : PERSONAL_ID
  const fromId = direction === 'out' ? active.id : peerId
  const toId = direction === 'out' ? peerId : active.id
  const partnership = activeIsPersonal ? partnerships.find((w) => w.id === otherId) : active
  const intoPartnership = toId !== PERSONAL_ID
  const partners = partnership?.partners ?? []
  const effectivePartner = partners.some((p) => p.id === partnerId) ? partnerId : (partners[0]?.id ?? 0)

  const source = useQuery(() => (partnership ? transfersApi.items({ workspace_id: fromId }) : Promise.resolve([] as Item[])), [fromId, !!partnership])
  const items = source.data ?? []

  const reset = () => setLines([emptyLine()])
  const changeDirection = (value: 'out' | 'in') => { setDirection(value); reset() }
  const changeOther = (id: number) => { setOtherId(id); reset() }
  const patch = (index: number, change: Partial<Line>) => setLines(lines.map((l, i) => (i === index ? { ...l, ...change } : l)))

  // في التعديل: القطع اللي في التحويل نفسه هترجع للمصدر قبل الحفظ، فبتتحسب ضمن المتاح
  const reserved = (l: Line) =>
    initial && initial.from_workspace_id === fromId
      ? initial.items.filter((x) => x.from_item_id === l.item_id && x.condition === l.condition).reduce((sum, x) => sum + x.quantity, 0)
      : 0

  const details = lines.map((l) => {
    const item = items.find((i) => i.id === l.item_id)
    const cost = item ? item[`${l.condition}_purchase_price`] : 0
    // البيع من المخزون الفعلي للشراكة بسعر البيع القطاعي افتراضيًا (زي الـ backend)
    const retail = item ? item[`${l.condition}_selling_price`] : 0
    const defaultPrice = kind === 'sale' && fromId === PERSONAL_ID && retail > 0 ? retail : cost
    const price = kind === 'sale' && l.price !== '' ? Number(l.price) || 0 : defaultPrice
    return { item, available: item ? item[`${l.condition}_quantity`] + reserved(l) : 0, cost, quantity: Number(l.quantity) || 0, price, defaultPrice }
  })
  const totalCost = details.reduce((sum, d) => sum + d.quantity * d.cost, 0)
  const totalPrice = details.reduce((sum, d) => sum + d.quantity * d.price, 0)

  const { submit, saving } = useSubmit(() =>
    onSubmit({
      from_workspace_id: fromId,
      to_workspace_id: toId,
      kind,
      partner_id: kind === 'half' ? null : effectivePartner,
      transfer_date: header.date,
      notes: header.notes,
      items: lines
        .filter((l) => l.item_id)
        .map((l) => ({ item_id: Number(l.item_id), condition: l.condition, quantity: l.quantity, unit_price: kind === 'sale' ? l.price : null }))
    })
  )

  if (!partnership) {
    return (
      <>
        <Alert tone="warning">{t('transfers.noPartnership')}</Alert>
        <Button onClick={onCancel}>{t('common.cancel')}</Button>
      </>
    )
  }

  const partnerLabel = kind === 'capital' ? t('transfers.capitalOwner') : intoPartnership ? t('transfers.sellerPartner') : t('transfers.buyerPartner')

  return (
    <form onSubmit={submit}>
      <div className="grid grid-cols-2 gap-x-4">
        <Field label={t('transfers.direction')}>
          <Select value={direction} onChange={(e) => changeDirection(e.target.value as 'out' | 'in')}>
            <option value="out">{t('transfers.out', { name: nameOf(active.id) })}</option>
            <option value="in">{t('transfers.in', { name: nameOf(active.id) })}</option>
          </Select>
        </Field>
        {activeIsPersonal ? (
          <Field label={t('transfers.partnership')}>
            <Select value={otherId} onChange={(e) => changeOther(Number(e.target.value))}>
              {partnerships.map((w) => <option key={w.id} value={w.id}>{nameOf(w.id)}</option>)}
            </Select>
          </Field>
        ) : (
          <Field label={t('transfers.otherStore')}>
            <Input readOnly value={nameOf(PERSONAL_ID)} className="bg-slate-50" />
          </Field>
        )}
      </div>

      <div className="mb-3.5 flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold text-slate-500">{t('transfers.kind')}</span>
        <Segmented value={kind} onChange={setKind} options={KINDS.map((k) => ({ value: k, label: t(`transfers.kinds.${k}`) }))} />
        <small className="text-slate-500">{t(`transfers.kindHint.${kind}`)}</small>
      </div>

      <div className="grid grid-cols-2 gap-x-4">
        {kind !== 'half' && (
          <Field label={partnerLabel}>
            <Select value={effectivePartner} onChange={(e) => setPartnerId(Number(e.target.value))}>
              {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
        )}
        <Field label={t('common.date')}>
          <Input type="date" value={header.date} onChange={(e) => setHeader({ ...header, date: e.target.value })} />
        </Field>
      </div>

      <div className="mb-2 flex flex-col gap-2">
        {lines.map((line, i) => (
          <div key={i} className="rounded-xl border border-slate-200 p-3">
            <div className="grid grid-cols-[minmax(160px,1fr)_100px_90px_110px_auto] items-end gap-2 xl:grid-cols-[1fr_110px_100px_120px_auto]">
              <Field label={t('common.product')} className="!mb-0">
                <ProductSelect items={items} value={{ item_id: line.item_id, name: '' }} onChange={(v) => patch(i, { item_id: v.item_id })} />
              </Field>
              <Field label={t('condition.label')} className="!mb-0">
                <Select value={line.condition} onChange={(e) => patch(i, { condition: e.target.value as Condition })}>
                  {CONDITIONS.map((c) => <option key={c} value={c}>{t(`condition.${c}`)}</option>)}
                </Select>
              </Field>
              <Field label={t('common.quantity')} className="!mb-0">
                <NumberInput step={1} value={line.quantity} onChange={(e) => patch(i, { quantity: e.target.value })} />
              </Field>
              {kind === 'sale' ? (
                <Field label={t('transfers.unitPrice')} className="!mb-0">
                  <NumberInput value={line.price} placeholder={String(details[i].defaultPrice)} onChange={(e) => patch(i, { price: e.target.value })} />
                </Field>
              ) : <span />}
              <Button variant="ghost" icon={Trash2} disabled={lines.length === 1} aria-label={t('common.removeLine')} onClick={() => setLines(lines.filter((_, k) => k !== i))} />
            </div>
            {details[i].item && (
              <small className="mt-1.5 block text-slate-500">
                {t('transfers.available')}: {details[i].available} · {t('transfers.unitCost')}: {formatMoney(details[i].cost, i18n.language)}
              </small>
            )}
          </div>
        ))}
      </div>
      <Button size="sm" icon={Plus} onClick={() => setLines([...lines, emptyLine()])}>{t('transfers.addLine')}</Button>

      <Field label={t('common.notes')} className="mt-4">
        <Input value={header.notes} onChange={(e) => setHeader({ ...header, notes: e.target.value })} />
      </Field>
      <p className="text-sm text-slate-600">
        {t('transfers.totalCost')}: <strong>{formatMoney(totalCost, i18n.language)}</strong>
        {kind === 'sale' && <> · {t('transfers.totalPrice')}: <strong>{formatMoney(totalPrice, i18n.language)}</strong></>}
      </p>
      <FormActions saving={saving} onCancel={onCancel} />
    </form>
  )
}
