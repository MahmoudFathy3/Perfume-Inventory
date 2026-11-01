import { useEffect, useState } from 'react'
import { AuthGate } from './features/auth'
import { settingsApi } from './features/settings'
import { WorkspaceProvider } from './features/workspaces'
import { applyLanguage } from './i18n'
import { DEFAULT_LANGUAGE } from './i18n/languages'
import AppRoutes from './routes'

/** التطبيق نفسه: بيتحمّل بعد فتح الداتا بيز بكلمة السر بس */
function AppContent() {
  const [ready, setReady] = useState(false)

  // اللغة المحفوظة في الإعدادات بتتطبق أول ما التطبيق يفتح
  useEffect(() => {
    settingsApi
      .get('language')
      .then((code) => applyLanguage(code ?? DEFAULT_LANGUAGE))
      .catch(() => applyLanguage(DEFAULT_LANGUAGE))
      .finally(() => setReady(true))
  }, [])

  return ready ? (
    <WorkspaceProvider>
      <AppRoutes />
    </WorkspaceProvider>
  ) : null
}

export default function App() {
  return (
    <AuthGate>
      <AppContent />
    </AuthGate>
  )
}
