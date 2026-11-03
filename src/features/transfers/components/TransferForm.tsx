import clsx from 'clsx'
import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Condition, Item, TransferDetails, TransferInput, TransferKind, TransferRecipient, Workspace } from '@shared/types'
import { ProductSelect } from '@/shared/components/data/ProductSelect'
import { Alert, Button, Field, FormActions, Input, NumberInput, Segmented, Select } from '@/shared/components/ui'
import { CONDITIONS } from '@/shared/constants'
import { useQuery } from '@/shared/hooks/useQuery'
import { useSubmit } from '@/shared/hooks/useSubmit'
import { formatMoney, todayString } from '@/shared/utils/format'
import { transfersApi } from '../api/transfers.api'

const PERSONAL_ID = 1
const KINDS: TransferKind[] = ['capital', 'sale', 'half']
/** لما التحويل لصاحب المخزون: رأس مال أو بيع بسعر بس */
const OWNER_KINDS: TransferKind[] = ['capital', 'sale']

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
    price: transfer.kind === 'sale' || transfer.recipient === 'partner' ? String(l.unit_price) : ''
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
 * من المخزون الفعلي للشراكة بنسأل الأول "لمين؟": صاحب المخزون (رأس مال / بيع بسعر)، أو الشريك التاني (اشتراها)،
 * أو الشراكة بالنص (بالتكلفة). مع initial بيبقى فورم تعديل بنفس بيانات التحويل.
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
  const [recipient, setRecipient] = useState<TransferRecipient>(initial?.recipient ?? 'partnership')
  const [buyerId, setBuyerId] = useState<number>(initial?.recipient === 'partner' ? (initial.partner_id ?? 0) : 0)

  // الطرف التاني: لو واقفين في المخزون الفعلي بنختار الشراكة، ولو واقفين في شراكة فالطرف التاني هو المخزون الفعلي
  const peerId = activeIsPersonal ? otherId : PERSONAL_ID
  const fromId = direction === 'out' ? active.id : peerId
  const toId = direction === 'out' ? peerId : active.id
  const partnership = activeIsPersonal ? partnerships.find((w) => w.id === otherId) : active
  const intoPartnership = toId !== PERSONAL_ID
  const partners = partnership?.partners ?? []
  // الافتراضي صاحب المخزون الفعلي (هو اللي بيدّي رأس المال أو بيبيع للشراكة أو بيشتري منها في الغالب)
  const defaultPartner = partners.find((p) => p.is_owner) ?? partners[0]
  const effectivePartner = partners.some((p) => p.id === partnerId) ? partnerId : (defaultPartner?.id ?? 0)

  // "لمين؟": من المخزون الفعلي لشراكة صاحب المخزون شريك فيها (التحويلات القديمة من غير "لمين" بتتعدّل بالطريقة القديمة)
  const owner = partners.find((p) => p.is_owner)
  const others = partners.filter((p) => !p.is_owner)
  const askRecipient = fromId === PERSONAL_ID && intoPartnership && !!owner && !(initial && !initial.recipient)
  const buyer = others.find((p) => p.id === buyerId) ?? others[0]
  const effectiveKind: TransferKind = !askRecipient ? kind : recipient === 'partner' ? 'capital' : recipient === 'partnership' ? 'sale' : OWNER_KINDS.includes(kind) ? kind : 'capital'
  // السطور ليها سعر: بيع بسعر، أو الشريك بيشتري. "للشراكة" دايمًا بالتكلفة.
  const priced = askRecipient ? (recipient === 'owner' && effectiveKind === 'sale') || recipient === 'partner' : kind === 'sale'

  const source = useQuery(() => (partnership ? transfersApi.items({ workspace_id: fromId }) : Promise.resolve([] as Item[])), [fromId, !!partnership])
  const items = source.data ?? []

  /** سعر القطعة في البيع: من المخزون الفعلي للشراكة بسعر البيع القطاعي (ولو مش متحدد بالتكلفة)، وغير كده بالتكلفة (زي الـ backend) */
  const priceOf = (itemId: Line['item_id'], condition: Condition) => {
    const item = items.find((i) => i.id === itemId)
    if (!item) return 0
    const retail = item[`${condition}_selling_price`]
    return fromId === PERSONAL_ID && retail > 0 ? retail : item[`${condition}_purchase_price`]
  }
  const priceText = (itemId: Line['item_id'], condition: Condition) => (itemId ? String(priceOf(itemId, condition)) : '')

  const reset = () => setLines([emptyLine()])
  const changeDirection = (value: 'out' | 'in') => { setDirection(value); reset() }
  const changeOther = (id: number) => { setOtherId(id); reset() }
  // لما نختار "بيع بسعر": السطور اللي سعرها فاضي بتتملى بسعر القطعة
  const changeKind = (value: TransferKind) => {
    setKind(value)
    if (value === 'sale') fillPrices()
  }
  const fillPrices = () => setLines(lines.map((l) => (l.price === '' ? { ...l, price: priceText(l.item_id, l.condition) } : l)))
  // "لمين" بالقيمة: owner | partnership | partner:<id>
  const recipientValue = recipient === 'partner' ? `partner:${buyer?.id ?? 0}` : recipient
  const changeRecipient = (value: string) => {
    if (value.startsWith('partner:')) {
      setRecipient('partner')
      setBuyerId(Number(value.slice(8)))
      fillPrices()
    } else {
      setRecipient(value as TransferRecipient)
      if (value === 'owner' && kind === 'sale') fillPrices()
    }
  }
  const patch = (index: number, change: Partial<Line>) =>
    setLines(
      lines.map((l, i) => {
        if (i !== index) return l
        const next = { ...l, ...change }
        // منتج أو حالة جديدة = سعر القطعة بتاعها (وتقدر تغيّره بعد كده)
        const productChanged = next.item_id !== l.item_id || next.condition !== l.condition
        return priced && productChanged ? { ...next, price: priceText(next.item_id, next.condition) } : next
      })
    )

  // في التعديل: القطع اللي في التحويل نفسه هترجع للمصدر قبل الحفظ، فبتتحسب ضمن المتاح
  const reserved = (l: Line) =>
    initial && initial.from_workspace_id === fromId
      ? initial.items.filter((x) => x.from_item_id === l.item_id && x.condition === l.condition).reduce((sum, x) => sum + x.quantity, 0)
      : 0

  const details = lines.map((l) => {
    const item = items.find((i) => i.id === l.item_id)
    const cost = item ? item[`${l.condition}_purchase_price`] : 0
    const defaultPrice = priced ? priceOf(l.item_id, l.condition) : cost
    const price = priced && l.price !== '' ? Number(l.price) || 0 : defaultPrice
    // أزرار السعر السريعة: القطاعي والجملة (لو متحددين) والتكلفة
    const presets = item
      ? ([
          ['priceRetail', item[`${l.condition}_selling_price`]],
          ['priceWholesale', item[`${l.condition}_wholesale_price`]],
          ['priceCost', cost]
        ] as const).filter(([key, value]) => value > 0 || key === 'priceCost')
      : []
    const quantity = Number(l.quantity) || 0
    return { item, available: item ? item[`${l.condition}_quantity`] + reserved(l) : 0, cost, quantity, price, defaultPrice, presets, profit: quantity * (price - cost) }
  })
  const totalCost = details.reduce((sum, d) => sum + d.quantity * d.cost, 0)
  const totalPrice = details.reduce((sum, d) => sum + d.quantity * d.price, 0)
  const totalProfit = totalPrice - totalCost
  const money = (v: number) => formatMoney(v, i18n.language)
  const profitTone = (v: number) => (v > 0 ? 'text-green-700' : v < 0 ? 'text-rose-600' : 'text-slate-600')

  const { submit, saving } = useSubmit(() =>
    onSubmit({
      from_workspace_id: fromId,
      to_workspace_id: toId,
      kind: effectiveKind,
      partner_id: askRecipient ? (recipient === 'partner' ? (buyer?.id ?? null) : (owner?.id ?? null)) : kind === 'half' ? null : effectivePartner,
      recipient: askRecipient ? recipient : null,
      transfer_date: header.date,
      notes: header.notes,
      items: lines
        .filter((l) => l.item_id)
        .map((l) => ({ item_id: Number(l.item_id), condition: l.condition, quantity: l.quantity, unit_price: priced ? l.price : null }))
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

      {askRecipient ? (
        <div className="mb-3.5 flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-slate-500">{t('transfers.recipient')}</span>
          <Segmented
            value={recipientValue}
            onChange={changeRecipient}
            options={[
              { value: 'owner', label: owner!.name },
              ...others.map((p) => ({ value: `partner:${p.id}`, label: p.name })),
              { value: 'partnership', label: t('transfers.recipientPartnership') }
            ]}
          />
          <small className="text-slate-500">
            {t(`transfers.recipientHint.${recipient}`, { owner: owner!.name, partner: buyer?.name ?? '' })}
          </small>
          {recipient === 'owner' && (
            <div className="mt-1.5 flex flex-col gap-1.5">
              <Segmented value={effectiveKind} onChange={changeKind} options={OWNER_KINDS.map((k) => ({ value: k, label: t(`transfers.kinds.${k}`) }))} />
              <small className="text-slate-500">{t(`transfers.kindHint.${effectiveKind}`)}</small>
            </div>
          )}
        </div>
      ) : (
        <div className="mb-3.5 flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-slate-500">{t('transfers.kind')}</span>
          <Segmented value={kind} onChange={changeKind} options={KINDS.map((k) => ({ value: k, label: t(`transfers.kinds.${k}`) }))} />
          <small className="text-slate-500">{t(`transfers.kindHint.${kind}`)}</small>
        </div>
      )}

      <div className="grid grid-cols-2 gap-x-4">
        {!askRecipient && kind !== 'half' && (
          <Field label={partnerLabel}>
            <Select value={effectivePartner} onChange={(e) => setPartnerId(Number(e.target.value))}>
              {partners.map((p) => <option key={p.id} value={p.id}>{p.is_owner ? `${p.name} (${t('workspaces.ownerTag')})` : p.name}</option>)}
            </Select>
          </Field>
        )}
        <Field label={t('common.date')}>
          <Input type="date" value={header.date} onChange={(e) => setHeader({ ...header, date: e.target.value })} />
        </Field>
      </div>

      {/* مين بيبيع / بينقل لمين: علشان الاتجاه يبقى واضح قبل اختيار المنتجات */}
      <p className="mb-2.5 rounded-xl bg-primary-50 px-3.5 py-2 text-sm font-semibold text-primary-800">
        {t(effectiveKind === 'sale' ? 'transfers.saleRoute' : 'transfers.moveRoute', { from: nameOf(fromId), to: nameOf(toId) })}
      </p>
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
              {priced ? (
                <Field label={t('transfers.unitPrice')} className="!mb-0">
                  <NumberInput value={line.price} placeholder={String(details[i].defaultPrice)} onChange={(e) => patch(i, { price: e.target.value })} />
                </Field>
              ) : <span />}
              <Button variant="ghost" icon={Trash2} disabled={lines.length === 1} aria-label={t('common.removeLine')} onClick={() => setLines(lines.filter((_, k) => k !== i))} />
            </div>
            {details[i].item && (
              <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 text-[13px] text-slate-500">
                <span>
                  {t('transfers.available')}: {details[i].available} · {t('transfers.unitCost')}: {money(details[i].cost)}
                  {priced && (
                    <> · {t('transfers.profitOf', { name: nameOf(fromId) })}: <strong className={profitTone(details[i].profit)}>{money(details[i].profit)}</strong></>
                  )}
                </span>
                {priced && (
                  <span className="flex flex-wrap gap-1.5">
                    {details[i].presets.map(([key, value]) => (
                      <Button
                        key={key}
                        size="sm"
                        className={clsx('rounded-full !px-3 !py-1 text-xs', Number(line.price) === value && '!border-primary-600 !bg-primary-600 font-semibold !text-white')}
                        onClick={() => patch(i, { price: String(value) })}
                      >
                        {t(`transfers.${key}`)}: {money(value)}
                      </Button>
                    ))}
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      <Button size="sm" icon={Plus} onClick={() => setLines([...lines, emptyLine()])}>{t('transfers.addLine')}</Button>

      <Field label={t('common.notes')} className="mt-4">
        <Input value={header.notes} onChange={(e) => setHeader({ ...header, notes: e.target.value })} />
      </Field>
      <p className="text-sm text-slate-600">
        {t('transfers.totalCost')}: <strong>{money(totalCost)}</strong>
        {priced && (
          <>
            {' · '}{t('transfers.totalPrice')}: <strong>{money(totalPrice)}</strong>
            {' · '}{t('transfers.profitOf', { name: nameOf(fromId) })}: <strong className={profitTone(totalProfit)}>{money(totalProfit)}</strong>
          </>
        )}
      </p>
      <FormActions saving={saving} onCancel={onCancel} />
    </form>
  )
}
