import { useTranslation } from 'react-i18next'
import { applyLanguage } from '@/i18n'
import { invoke } from '../api/ipc'

export function useLanguage() {
  const { i18n } = useTranslation()

  async function setLanguage(code: string): Promise<void> {
    applyLanguage(code)
    await invoke('settings:set', { key: 'language', value: code })
  }

  return { language: i18n.language, setLanguage }
}
