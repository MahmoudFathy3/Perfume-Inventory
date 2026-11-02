import { Layers, PackageCheck, PackageX, Store, Tag } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Condition, PriceType } from '@shared/types'
import { invoke } from '@/shared/api/ipc'
import { DropdownMenu } from '@/shared/components/ui'
import { useToast } from '@/shared/toast/ToastProvider'
import { itemsApi } from '@/features/items'
import { buildPriceList } from '@/features/items/utils/priceList'
import { useWorkspaces } from '@/features/workspaces'

/** اسم الاختيار في رسالة النجاح (مثلًا "الديفوه بالجملة") */
const OPTION_LABEL: Record<Condition, Record<PriceType, string>> = {
  new: { retail: 'items.copyNewRetail', wholesale: 'items.copyNewWholesale' },
  damaged: { retail: 'items.copyDamagedRetail', wholesale: 'items.copyDamagedWholesale' }
}

/**
 * نسخ قايمة المخزن الحالي (الفعلي أو الشراكة): زرار للقطاعي وزرار للجملة، وكل واحد فيه السليم أو الديفوه.
 * اسم المخزن ونوع القايمة في أول سطر، والمنتج اللي كميته صفر مبيتنسخش.
 * في المخزون الفعلي فيه زرار زيادة: قايمة كل المخازن (الفعلي + الشراكات) من غير تكرار.
 */
export function CopyStockButtons() {
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const { active, label } = useWorkspaces()

  async function copy(priceType: PriceType, condition: Condition, allStores = false) {
    try {
      const items = await (allStores ? itemsApi.allStores() : itemsApi.list({}))
      const name = allStores ? t('dashboard.allStores') : label(active)
      const title = `${name} — ${t(`items.copyTitle.${condition}`)}`
      const text = buildPriceList(items, i18n.language, { priceType, condition, title, inStockOnly: true })
      if (!text) return toast.info(t('dashboard.copyEmpty'))
      await invoke('clipboard:writeText', { text })
      toast.success(t('toast.copiedStock', { name, type: t(OPTION_LABEL[condition][priceType]) }))
    } catch (e) {
      toast.fail(e)
    }
  }

  const menu = (priceType: PriceType) => [
    { key: 'new', label: t('dashboard.copyCondition.new'), icon: PackageCheck, onSelect: () => void copy(priceType, 'new') },
    { key: 'damaged', label: t('dashboard.copyCondition.damaged'), icon: PackageX, onSelect: () => void copy(priceType, 'damaged') }
  ]

  return (
    <>
      <DropdownMenu icon={Tag} label={t('dashboard.copyRetail')} items={menu('retail')} />
      <DropdownMenu icon={Store} label={t('dashboard.copyWholesale')} items={menu('wholesale')} />
      {active.kind === 'personal' && (
        <DropdownMenu
          icon={Layers}
          label={t('dashboard.copyAllStores')}
          items={(['retail', 'wholesale'] as const).flatMap((priceType) =>
            (['new', 'damaged'] as const).map((condition) => ({
              key: `${priceType}-${condition}`,
              label: t(OPTION_LABEL[condition][priceType]),
              icon: condition === 'new' ? PackageCheck : PackageX,
              onSelect: () => void copy(priceType, condition, true)
            }))
          )}
        />
      )}
    </>
  )
}
