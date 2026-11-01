import { useState } from 'react'
import type { FormEvent } from 'react'
import { useToast } from '../toast/ToastProvider'

/** بيلف حفظ الفورم: حالة الحفظ + أي خطأ بيظهر كـ toast مترجم (والفورم بيفضل مفتوح) */
export function useSubmit(action: () => Promise<unknown> | unknown) {
  const toast = useToast()
  const [saving, setSaving] = useState(false)

  async function submit(event?: FormEvent): Promise<void> {
    event?.preventDefault()
    setSaving(true)
    try {
      await action()
    } catch (e) {
      toast.fail(e)
    } finally {
      setSaving(false)
    }
  }
  return { submit, saving }
}
