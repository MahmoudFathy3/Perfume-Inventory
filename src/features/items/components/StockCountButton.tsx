import { useState } from 'react'
import { ClipboardList, Copy } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { invoke } from '@/shared/api/ipc'
import { Button, Modal } from '@/shared/components/ui'
import { useToast } from '@/shared/toast/ToastProvider'
import { useWorkspaces } from '@/features/workspaces'
import { itemsApi } from '../api/items.api'
import { buildStockCount } from '../utils/stockCount'

/** جرد المخزن الحالي: كل منتج وعدده الجديد (سليم) والتالف (ديفوه)، في نافذة مع زرار نسخ */
export function StockCountButton() {
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const { active, label } = useWorkspaces()
  const [text, setText] = useState<string | null>(null)

  async function open() {
    try {
      const items = await itemsApi.list({}) // كل المنتجات (مش اللي في الصفحة بس)
      const result = buildStockCount(items, i18n.language, {
        title: t('items.stockCount.heading', { name: label(active) }),
        labels: { new: t('items.stockCount.new'), damaged: t('items.stockCount.damaged') }
      })
      if (!result) return toast.info(t('items.stockCount.empty'))
      setText(result)
    } catch (e) {
      toast.fail(e)
    }
  }

  async function copy() {
    if (!text) return
    try {
      await invoke('clipboard:writeText', { text })
      toast.success(t('items.stockCount.copied'))
    } catch (e) {
      toast.fail(e)
    }
  }

  return (
    <>
      <Button icon={ClipboardList} onClick={() => void open()}>{t('items.stockCount.button')}</Button>
      {text && (
        <Modal title={t('items.stockCount.title')} onClose={() => setText(null)}>
          <pre dir="auto" className="mb-4 max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-4 font-sans text-sm leading-7 text-slate-800">{text}</pre>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setText(null)}>{t('common.close')}</Button>
            <Button variant="primary" icon={Copy} onClick={() => void copy()}>{t('items.stockCount.copy')}</Button>
          </div>
        </Modal>
      )}
    </>
  )
}
