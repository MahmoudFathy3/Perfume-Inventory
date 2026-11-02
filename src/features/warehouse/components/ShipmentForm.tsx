import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { WarehouseItem, WarehouseShipmentInput, Workspace } from '@shared/types'
import { OptionSelect } from '@/shared/components/data/OptionSelect'
import { Button, Field, FormActions, Input, NumberInput, Select } from '@/shared/components/ui'
import { useSubmit } from '@/shared/hooks/useSubmit'
import { todayString } from '@/shared/utils/format'

const PERSONAL_ID = 1

interface Line {
  item_id: number | ''
  quantity: string
}
const emptyLine = (): Line => ({ item_id: '', quantity: '1' })

interface ShipmentFormProps {
  items: WarehouseItem[]
  /** المخازن المفتوحة اللي ممكن الشحنة تروحلها */
  destinations: Workspace[]
  nameOf: (workspaceId: number) => string
  onSubmit: (payload: WarehouseShipmentInput) => Promise<unknown>
  onCancel: () => void
}

/** شحنة من مخزن السعودية لمخزن في مصر (الفعلي أو شراكة): المنتجات والكميات بس */
export function ShipmentForm({ items, destinations, nameOf, onSubmit, onCancel }: ShipmentFormProps) {
  const { t } = useTranslation()
  const [header, setHeader] = useState({ date: todayString(), workspaceId: PERSONAL_ID, notes: '' })
  const [lines, setLines] = useState<Line[]>([emptyLine()])
  const patch = (index: number, change: Partial<Line>) => setLines(lines.map((l, i) => (i === index ? { ...l, ...change } : l)))
  const options = items.filter((i) => i.quantity > 0).map((i) => ({ value: i.id, label: i.name }))

  const { submit, saving } = useSubmit(() =>
    onSubmit({ ship_date: header.date, workspace_id: header.workspaceId, notes: header.notes, items: lines })
  )

  return (
    <form onSubmit={submit}>
      <div className="grid grid-cols-2 gap-x-4">
        <Field label={t('warehouse.destination')}>
          <Select value={header.workspaceId} onChange={(e) => setHeader({ ...header, workspaceId: Number(e.target.value) })}>
            {destinations.map((w) => <option key={w.id} value={w.id}>{nameOf(w.id)}</option>)}
          </Select>
        </Field>
        <Field label={t('warehouse.shipDate')}>
          <Input type="date" value={header.date} onChange={(e) => setHeader({ ...header, date: e.target.value })} />
        </Field>
      </div>

      <div className="mb-2 flex flex-col gap-2">
        {lines.map((line, i) => {
          const available = items.find((it) => it.id === line.item_id)?.quantity
          return (
            <div key={i} className="grid grid-cols-[1fr_110px_auto] items-end gap-2 rounded-xl border border-slate-200 p-3">
              <Field label={t('common.product')} className="!mb-0">
                <OptionSelect options={options} value={line.item_id} onChange={(v) => patch(i, { item_id: v })} />
              </Field>
              <Field label={t('common.quantity')} className="!mb-0">
                <NumberInput step={1} value={line.quantity} onChange={(e) => patch(i, { quantity: e.target.value })} />
              </Field>
              <Button variant="ghost" icon={Trash2} disabled={lines.length === 1} aria-label={t('common.removeLine')} onClick={() => setLines(lines.filter((_, k) => k !== i))} />
              {available !== undefined && <small className="col-span-3 text-slate-500">{t('warehouse.available')}: {available}</small>}
            </div>
          )
        })}
      </div>
      <Button size="sm" icon={Plus} onClick={() => setLines([...lines, emptyLine()])}>{t('warehouse.addLine')}</Button>

      <Field label={t('common.notes')} className="mt-4">
        <Input value={header.notes} onChange={(e) => setHeader({ ...header, notes: e.target.value })} />
      </Field>
      <FormActions saving={saving} onCancel={onCancel} />
    </form>
  )
}
