import { PackagePlus, Truck } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { WarehouseItem, WarehouseItemInput, WarehouseShipment, WarehouseShipmentInput } from '@shared/types'
import { ExportMenu } from '@/shared/components/data/ExportMenu'
import { SearchBar } from '@/shared/components/data/SearchBar'
import { Button, Modal, PageHeader, Segmented, StatCard } from '@/shared/components/ui'
import { useConfirmDelete } from '@/shared/hooks/useConfirmDelete'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { useQuery } from '@/shared/hooks/useQuery'
import { useToast } from '@/shared/toast/ToastProvider'
import { formatNumber } from '@/shared/utils/format'
import { useWorkspaces } from '../../workspaces'
import { warehouseApi } from '../api/warehouse.api'
import { ShipmentForm } from '../components/ShipmentForm'
import { ShipmentsTable } from '../components/ShipmentsTable'
import { WarehouseItemForm } from '../components/WarehouseItemForm'
import { WarehouseItemsTable } from '../components/WarehouseItemsTable'
import { formatSar, totalCost } from '../utils/costs'

type Tab = 'items' | 'shipments'

/**
 * المخزن الخارجي (السعودية): كميات المنتجات + الشحنات لمصر. من غير أسعار، ومن غير ما البضاعة تدخل مخازن مصر:
 * لما الشحنة توصل بتتسجل فاتورة شراء عادي في المخزن اللي استلمها.
 */
export default function WarehousePage() {
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const { workspaces, active, label } = useWorkspaces()
  const [tab, setTab] = useState<Tab>('items')
  const [search, setSearch] = useState('')
  const q = useDebounce(search)
  const [editing, setEditing] = useState<{ row: WarehouseItem | null } | null>(null)
  const [shipping, setShipping] = useState(false)

  const items = useQuery(() => warehouseApi.items({ search: q }), [q])
  const allItems = useQuery(() => warehouseApi.items({}), [])
  const shipments = useQuery(() => warehouseApi.shipments(), [])
  const nameOf = (id: number) => {
    const ws = workspaces.find((w) => w.id === id)
    return ws ? label(ws) : '—'
  }

  /** أي تغيير في الشحنات بيغيّر الكميات */
  const refresh = () => {
    items.reload()
    allItems.reload()
    shipments.reload()
  }

  async function saveItem(values: WarehouseItemInput) {
    if (editing?.row) await warehouseApi.updateItem({ id: editing.row.id, ...values })
    else await warehouseApi.createItem(values)
    toast.success(t(editing?.row ? 'toast.updated' : 'toast.created'))
    setEditing(null)
    refresh()
  }

  async function ship(payload: WarehouseShipmentInput) {
    await warehouseApi.createShipment(payload)
    toast.success(t('toast.created'))
    setShipping(false)
    refresh()
  }

  async function toggleArrived(row: WarehouseShipment) {
    try {
      await warehouseApi.setArrived({ id: row.id, arrived: row.status !== 'arrived' })
      if (row.status !== 'arrived') toast.info(t('warehouse.arrivedNote'))
      shipments.reload()
    } catch (e) {
      toast.fail(e)
    }
  }

  const deleteItem = useConfirmDelete<WarehouseItem>(
    async (row) => {
      await warehouseApi.removeItem({ id: row.id })
      toast.success(t('toast.deleted'))
      refresh()
    },
    { getName: (row) => row.name }
  )
  const deleteShipment = useConfirmDelete<WarehouseShipment>(
    async (row) => {
      await warehouseApi.removeShipment({ id: row.id })
      toast.success(t('toast.deleted'))
      refresh()
    },
    { getName: (row) => `#${row.id}`, note: t('warehouse.deleteShipmentNote') }
  )

  const num = (v: number) => formatNumber(v, i18n.language)
  const stockPieces = (allItems.data ?? []).reduce((sum, i) => sum + i.quantity, 0)
  const stockValue = (allItems.data ?? []).reduce((sum, i) => sum + totalCost(i), 0)
  const inTransit = (shipments.data ?? []).filter((s) => s.status === 'in_transit')

  return (
    <>
      <PageHeader title={label(active)}>
        {tab === 'items' && <SearchBar value={search} onChange={setSearch} />}
        <ExportMenu target={{ dataset: 'warehouse', search: q }} />
        <Button icon={Truck} onClick={() => setShipping(true)}>{t('warehouse.newShipment')}</Button>
        <Button variant="primary" icon={PackagePlus} onClick={() => setEditing({ row: null })}>{t('warehouse.addItem')}</Button>
      </PageHeader>

      <div className="mb-4 grid grid-cols-3 gap-4">
        <StatCard label={t('warehouse.stockPieces', { name: label(active) })} value={num(stockPieces)} tone="teal" big />
        <StatCard label={t('warehouse.stockValue')} value={formatSar(stockValue, i18n.language)} sub={t('warehouse.stockValueSub')} tone="green" big />
        <StatCard label={t('warehouse.inTransitPieces')} value={num(inTransit.reduce((sum, s) => sum + s.pieces, 0))} sub={t('warehouse.shipmentsCount', { count: inTransit.length })} tone="indigo" big />
      </div>
      <p className="mb-4 text-sm text-slate-500">{t('warehouse.note')}</p>

      <div className="mb-4">
        <Segmented value={tab} onChange={setTab} options={[{ value: 'items', label: t('warehouse.items') }, { value: 'shipments', label: t('warehouse.shipments') }]} />
      </div>

      {tab === 'items' ? (
        <WarehouseItemsTable rows={items.data ?? []} onEdit={(row) => setEditing({ row })} onDelete={deleteItem.ask} />
      ) : (
        <ShipmentsTable rows={shipments.data ?? []} nameOf={nameOf} onToggleArrived={toggleArrived} onDelete={deleteShipment.ask} />
      )}

      {editing && (
        <Modal title={t(editing.row ? 'warehouse.editItem' : 'warehouse.addItem')} onClose={() => setEditing(null)}>
          <WarehouseItemForm initial={editing.row} onSubmit={saveItem} onCancel={() => setEditing(null)} />
        </Modal>
      )}
      {shipping && (
        <Modal title={t('warehouse.newShipment')} onClose={() => setShipping(false)} wide>
          <ShipmentForm
            items={allItems.data ?? []}
            destinations={workspaces.filter((w) => !w.closed_at && w.kind !== 'warehouse')}
            nameOf={nameOf}
            onSubmit={ship}
            onCancel={() => setShipping(false)}
          />
        </Modal>
      )}
      {deleteItem.dialog}
      {deleteShipment.dialog}
    </>
  )
}
