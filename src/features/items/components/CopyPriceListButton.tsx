import { ClipboardCopy, PackageCheck, PackageX } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Condition, PriceType } from '@shared/types'
import { invoke } from '@/shared/api/ipc'
import { DropdownMenu } from '@/shared/components/ui'
import { useToast } from '@/shared/toast/ToastProvider'
import { itemsApi } from '../api/items.api'
import { buildPriceList } from '../utils/priceList'

const OPTIONS: { condition: Condition; priceType: PriceType; label: string }[] = [
  { condition: 'new', priceType: 'retail', label: 'items.copyNewRetail' },
  { condition: 'new', priceType: 'wholesale', label: 'items.copyNewWholesale' },
  { condition: 'damaged', priceType: 'retail', label: 'items.copyDamagedRetail' },
  { condition: 'damaged', priceType: 'wholesale', label: 'items.copyDamagedWholesale' }
]

/**
 * نسخ قايمة المنتجات (الصنف وتحته منتجاته وسعر القطعة) للـ clipboard:
 * السليم (الجديد) لوحده أو الديفوه (التالف) لوحده، بالقطاعي أو بالجملة. المنتج اللي مفيش منه مبيتنسخش.
 */
export function CopyPriceListButton() {
  const { t, i18n } = useTranslation()
  const toast = useToast()

  async function copy(condition: Condition, priceType: PriceType) {
    try {
      // كل المنتجات (مش اللي في الصفحة بس)، واللي كميته صفر في الحالة دي مبيتنسخش
      const items = (await itemsApi.list({})).filter((i) => i[`${condition}_quantity`] > 0)
      if (items.length === 0) return toast.info(t('items.copyEmpty'))
      const text = buildPriceList(items, i18n.language, { priceType, condition, title: t(`items.copyTitle.${condition}`) })
      await invoke('clipboard:writeText', { text })
      toast.success(t('toast.copied', { count: items.length }))
    } catch (e) {
      toast.fail(e)
    }
  }

  return (
    <DropdownMenu
      icon={ClipboardCopy}
      label={t('items.copyList')}
      items={OPTIONS.map((o) => ({
        key: `${o.condition}-${o.priceType}`,
        label: t(o.label),
        icon: o.condition === 'new' ? PackageCheck : PackageX,
        onSelect: () => void copy(o.condition, o.priceType)
      }))}
    />
  )
}
