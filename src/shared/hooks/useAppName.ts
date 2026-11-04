import { useEffect, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { ENV } from '@/config/env'
import { invoke } from '../api/ipc'

// اسم البرنامج اللي المستخدم اختاره (الفاضي = الاسم الافتراضي من الترجمة). بيتحمّل مرة واحدة، وأي تغيير بيوصل لكل الأماكن.
let custom = ''
let loaded = false
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((listener) => listener())

function load(): void {
  if (loaded) return
  loaded = true
  invoke<string>('app:name')
    .then((name) => {
      custom = name ?? ''
      emit()
    })
    .catch(() => (loaded = false)) // نحاول تاني المرة الجاية
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** حفظ اسم جديد (الفاضي = يرجع للاسم الافتراضي) */
export async function saveAppName(name: string): Promise<void> {
  await invoke('settings:setAppName', { name })
  custom = name.trim()
  emit()
}

/** اسم البرنامج اللي بيتعرض (القايمة الجانبية، شاشة الدخول، الفاتورة، عنوان النافذة) */
export function useAppName(): { name: string; custom: string } {
  const { t } = useTranslation()
  load()
  const value = useSyncExternalStore(subscribe, () => custom)
  const name = value || t('app.name')

  useEffect(() => {
    document.title = ENV.isDev ? `${name} [DEV]` : name
  }, [name])

  return { name, custom: value }
}
