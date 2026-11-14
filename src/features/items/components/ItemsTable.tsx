import { Eye, Pencil, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Condition, Item } from '@shared/types'
import { Button, DataTable, RowActions } from '@/shared/components/ui'
import type { Column } from '@/shared/components/ui'
import { formatMoney, formatNumber } from '@/shared/utils/format'

/** خلية المخزون: الكمية بخط كبير وتحتها أسعار الشراء والبيع والجملة */
function StockCell({ item, condition }: { item: Item; condition: Condition }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const quantity = item[`${condition}_quantity`]
  const purchase = item[`${condition}_purchase_price`]
  const selling = item[`${condition}_selling_price`]
  const wholesale = item[`${condition}_wholesale_price`]
  // محجوز في فواتير تحت التجهيز (لسه في المخزن بس مش متاح للبيع)
  const reserved = item[`${condition}_reserved`] ?? 0
  if (!quantity && !selling && !wholesale) return <span className="text-slate-400">0</span>
  return (
    <>
      <strong className="block text-base">{formatNumber(quantity, lang)}</strong>
      {reserved > 0 && (
        <small className="block text-xs font-semibold text-amber-700">
          {t('items.reserved', { reserved: formatNumber(reserved, lang), available: formatNumber(Math.max(0, quantity - reserved), lang) })}
        </small>
      )}
      <small className="mt-0.5 flex flex-wrap gap-x-2.5 text-xs text-slate-500">
        <span>{t('items.buyShort')} {formatMoney(purchase, lang)}</span>
        <span>{t('items.sellShort')} {formatMoney(selling, lang)}</span>
        <span>{t('items.wholesaleShort')} {formatMoney(wholesale, lang)}</span>
      </small>
    </>
  )
}

interface ItemsTableProps {
  items: Item[]
  onEdit: (item: Item) => void
  onDelete: (item: Item) => void
  onDetails: (item: Item) => void
}

export function ItemsTable({ items, onEdit, onDelete, onDetails }: ItemsTableProps) {
  const { t } = useTranslation()

  const columns: Column<Item>[] = [
    { key: 'name_ar', header: t('items.nameAr'), cell: (i) => <Button variant="link" onClick={() => onDetails(i)}>{i.name_ar}</Button> },
    { key: 'name_en', header: t('items.nameEn'), cellClassName: 'whitespace-nowrap', cell: (i) => <span dir="ltr">{i.name_en}</span> },
    { key: 'category', header: t('categories.category'), cellClassName: 'whitespace-nowrap', cell: (i) => i.category_name },
    { key: 'new', header: t('condition.new'), headerClassName: '!bg-green-100 !text-green-800', cell: (i) => <StockCell item={i} condition="new" /> },
    { key: 'damaged', header: t('condition.damaged'), headerClassName: '!bg-orange-100 !text-orange-800', cell: (i) => <StockCell item={i} condition="damaged" /> },
    {
      key: 'actions',
      header: t('common.actions'),
      cell: (i) => (
        <RowActions>
          <Button size="sm" icon={Eye} onClick={() => onDetails(i)}>{t('items.details')}</Button>
          <Button size="sm" icon={Pencil} onClick={() => onEdit(i)}>{t('common.edit')}</Button>
          <Button size="sm" variant="danger" icon={Trash2} onClick={() => onDelete(i)}>{t('common.delete')}</Button>
        </RowActions>
      )
    }
  ]

  return <DataTable columns={columns} rows={items} rowKey={(i) => i.id} />
}
